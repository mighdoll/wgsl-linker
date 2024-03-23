import { linkWgslModule } from "./Linker.js";
import { TextExport, TextModule, parseModule } from "./ParseModule.js";
import { basename, normalize, relativePath } from "./PathUtil.js";

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
  private modules: TextModule[] = [];

  constructor() {
    /** TODO accept hash of options*/
  }

  /**
   * Produced a linked wgsl string with all directives processed
   * (e.g. #import'd functions from other modules are inserted into the resulting string).
   * @param moduleName select the module to use as the root source
   * @param runtimeParams runtime parameters for #import/#export values, 
   *  provide values for templates, and settings for code generation
   */
  link(moduleName: string, runtimeParams: Record<string, any> = {}): string {
    const foundModule = this.findModule(moduleName);
    if (foundModule) {
      return linkWgslModule(foundModule, this, runtimeParams);
    }
    console.error("no module found for ", moduleName);
    return "";
  }

  /**
   * Register and parse wgsl text modules with optional directives.
   * @param files record. keys are file names and values contain wgsl text with directives
   * @param params runtime name-value variables for conditional compilation
   */
  registerMany(
    files: Record<string, string>,
    params: Record<string, any> = {}
  ): void {
    const nameSrc = Object.entries(files);
    nameSrc.forEach(([fileName, src]) => {
      this.registerOneModule(src, params, fileName);
    });
  }

  /** register one module's exports  */
  registerOneModule(
    src: string,
    params: Record<string, any> = {},
    fileName?: string,
    moduleName?: string
  ): void {
    const m = parseModule(src, params, moduleName);
    m.fileName = fileName && normalize(fileName);
    this.addTextModule(m);
  }

  /** register a function that generates code on demand */
  registerGenerator(reg: RegisterGenerator): void {
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
    requesting: TextModule,
    exportName: string,
    moduleName?: string
  ): ModuleExport | undefined {
    const exports = this.exports.get(exportName);
    if (!exports) {
      return undefined;
    } else if (moduleName?.startsWith(".")) {
      const searchName = relativePath(requesting.fileName, moduleName);
      const baseSearch = basename(searchName);

      return exports.find((e) => {
        const fileName = (e.module as TextModule).fileName;
        if (!fileName) return false;
        if (fileName === searchName) return true;
        if (baseSearch === basename(fileName)) return true;
      });
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

  private findModule(searchName: string): TextModule | undefined {
    const exactMatch = this.modules.find(
      (m) => m.name === searchName || m.fileName === searchName
    );
    if (exactMatch) return exactMatch;
    const baseSearch = basename(searchName);
    return this.modules.find(
      (m) => m.fileName && basename(m.fileName) === baseSearch
    );
  }

  private addTextModule(module: TextModule): void {
    this.modules.push(module); // TODO dedupe?
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
