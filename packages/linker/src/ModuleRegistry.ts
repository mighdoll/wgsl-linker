import { parseModule, TextExport, TextModule } from "./ParseModule.js";

/** A named function to transform code fragments (e.g. by inserting parameters) */
export interface Template {
  name: string;
  apply: ApplyTemplateFn;
}
export type CodeGenFn = (
  name: string,
  params: Record<string, string>
) => string;

export interface GeneratorExport {
  name: string;
  args: string[];
  generate: CodeGenFn;
}

export interface RegisterGenerator {
  name: string;
  moduleName: string;
  generate: CodeGenFn;
  args?: string[];
}

export type ApplyTemplateFn = (
  src: string,
  params: Record<string, any> // combination of external params and imp/exp params
) => string;

/** a single export from a module */
export type ModuleExport = TextModuleExport | GeneratorModuleExport;

export interface TextModuleExport {
  module: TextModule;
  export: TextExport;
  kind: "text";
}

export interface GeneratorModule {
  kind: "generator";
  name: string;
  exports: GeneratorExport[];
}

export interface GeneratorModuleExport {
  module: GeneratorModule;
  export: GeneratorExport;
  kind: "function";
}

/** unique index for naming otherwise unnamed generator modules */
let unnamedCodeDex = 0;

/**
 * A ModuleRegistry collects exportable code fragments, code generator functions,
 * and template processors.
 *
 * The ModuleRegistry provides everything required for linkWgsl to process
 * #import statements and generate a complete wgsl shader.
 */
export class ModuleRegistry {
  // map from export names to a map of module names to exports
  private exports = new Map<string, ModuleExport[]>();
  private templates = new Map<string, ApplyTemplateFn>();

  constructor(...src: string[]) {
    this.registerModules({}, ...src);
  }

  /** register modules' exports */
  registerModules(params: Record<string, any>, ...sources: string[]): void {
    sources.forEach((src) => this.registerOneModule(src, params));
  }

  /** register one module's exports  */
  registerOneModule(
    src: string,
    params: Record<string, any>,
    moduleName?: string
  ): void {
    const m = parseModule(src, params, moduleName);
    this.addTextModule(m);
  }

  /** register a function that generates code on demand */
  registerGenerator2(reg:RegisterGenerator):void {
    const exp: GeneratorExport = {
      name: reg.name,
      args: reg.args ?? [],
      generate: reg.generate,
    };
    const module: GeneratorModule = {
      kind: "generator",
      name: reg.moduleName ?? `funModule${unnamedCodeDex++}`,
      exports: [exp],
    };
    const moduleExport: GeneratorModuleExport = {
      module,
      export: exp,
      kind: "function",
    };
    this.addModuleExport(moduleExport);
  }

  /** register a function that generates code on demand */
  registerGenerator(
    exportName: string,
    fn: CodeGenFn,
    params?: string[],
    moduleName?: string
  ): void {
    const exp: GeneratorExport = {
      name: exportName,
      args: params ?? [],
      generate: fn,
    };
    const module: GeneratorModule = {
      kind: "generator",
      name: moduleName ?? `funModule${unnamedCodeDex++}`,
      exports: [exp],
    };
    const moduleExport: GeneratorModuleExport = {
      module,
      export: exp,
      kind: "function",
    };
    this.addModuleExport(moduleExport);
  }

  /** register a template processor  */
  registerTemplate(...templates: Template[]): void {
    templates.forEach((t) => this.templates.set(t.name, t.apply));
  }

  /** fetch a template processor */
  getTemplate(name: string): ApplyTemplateFn | undefined {
    return this.templates.get(name);
  }

  /** return a reference to an exported text fragment or code generator (i.e. in response to an #import request) */
  getModuleExport(
    exportName: string,
    moduleName?: string
  ): ModuleExport | undefined {
    const exports = this.exports.get(exportName);
    if (!exports) {
      return undefined;
    } else if (moduleName) {
      return exports.find((e) => e.module.name === moduleName);
    } else if (exports.length === 1) {
      return exports[0];
    } else {
      const moduleNames = exports.map((e) => e.module.name).join(", ");
      console.warn(
        `Multiple modules export "${exportName}". (${moduleNames}) ` +
          `Use "#import ${exportName} from <moduleName>" to select which one import`
      );
    }
  }

  private addTextModule(module: TextModule): void {
    module.exports.forEach((e) => {
      const moduleExport: TextModuleExport = {
        module,
        export: e,
        kind: "text",
      };
      this.addModuleExport(moduleExport);
    });
  }

  private addModuleExport(moduleExport: ModuleExport): void {
    const expName = exportName(moduleExport);
    const existing = this.exports.get(expName);
    if (existing) {
      existing.push(moduleExport);
    } else {
      this.exports.set(expName, [moduleExport]);
    }
  }
}

function exportName(moduleExport: ModuleExport): string {
  if (moduleExport.kind === "text") {
    return moduleExport.export.ref.name;
  } else {
    return moduleExport.export.name;
  }
}
