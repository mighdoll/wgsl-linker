import { linkWgslModule } from "./Linker.js";
import { parseModule, TextExport, TextModule } from "./ParseModule.js";
import { normalize, noSuffix, relativePath } from "./PathUtil.js";

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

/** a named code generation function */
export interface RegisterGenerator {
  /** export name for this generator */
  name: string;

  /** module namespace for this generator */
  moduleName: string;

  /** function to generate code at runtime */
  generate: CodeGenFn;

  /** arguments to pass when importing from this generator */
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

/** unique index for naming otherwise unnamed generator modules and src files */
let unnamedCodeDex = 0;
let unnamedTextDex = 0;

export interface RegistryParams {
  /** record of file names an wgsl text for modules */
  wgsl?: Record<string, string>;

  /** alt interface to provide wgsl module texts w/o file names.
   * (usually best to provide filenames though, to allow relative imports) */
  rawWgsl?: string[];

  /** string template handlers for processing exported functions and structs */
  templates?: Template[];

  /** code generation functions */
  generators?: RegisterGenerator[];

  /** values for #if condition processing */
  conditions?: Record<string, any>;
}

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
  private textModules: TextModule[] = [];
  private wgslSrc = new Map<string, string>();

  constructor(args?: RegistryParams) {
    if (!args) return;
    const { wgsl = {}, rawWgsl = [], templates = [], generators } = args;

    Object.entries(wgsl).forEach(([fileName, src]) =>
      this.wgslSrc.set(normalize(fileName), src)
    );
    rawWgsl.forEach((src) =>
      this.wgslSrc.set(`rawWgsl-${unnamedTextDex++}`, src)
    );
    templates && this.registerTemplate(...templates);
    generators?.map((g) => this.registerGenerator(g));
  }

  /**
   * Produce a linked wgsl string with all directives processed
   * (e.g. #import'd functions from other modules are inserted into the resulting string).
   * @param moduleName select the module to use as the root source
   * @param runtimeParams runtime parameters for #import/#export values,
   *  template values, and code generation parameters
   */
  link(moduleName: string, runtimeParams: Record<string, any> = {}): string {
    this._parseSrc(runtimeParams);
    const rootModule = this.findTextModule(moduleName);
    if (!rootModule) {
      console.error("no module found for ", moduleName);
      return "";
    }

    return linkWgslModule(rootModule, this, runtimeParams);
  }

  _parseSrc(runtimeParams: Record<string, any> = {}): void {
    this.textModules = [];
    this.wgslSrc.forEach((src, fileName) => {
      // dlog("parseSrc", { fileName, src });
      this.registerOneModule(src, runtimeParams, fileName);
    });
  }

  /** register one module's exports  */
  private registerOneModule(
    src: string,
    params: Record<string, any> = {},
    fileName: string,
    moduleName?: string
  ): void {
    const newFileName = fileName && normalize(fileName);
    const m = parseModule(src, newFileName, params, moduleName);
    this.addTextModule(m);
  }

  /** register a function that generates code on demand */
  registerGenerator(reg: RegisterGenerator): void {
    const exp: GeneratorExport = {
      name: reg.name,
      args: reg.args ?? [],
      generate: reg.generate
    };
    const module: GeneratorModule = {
      kind: "generator",
      name: reg.moduleName ?? `funModule${unnamedCodeDex++}`,
      exports: [exp]
    };
    const moduleExport: GeneratorModuleExport = {
      module,
      export: exp,
      kind: "function"
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
      const baseSearch = noSuffix(searchName);

      return exports.find((e) => {
        const fileName = (e.module as TextModule).fileName;
        if (!fileName) return false;
        if (fileName === searchName) return true;
        if (baseSearch === noSuffix(fileName)) return true;
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

  findTextModule(searchName: string): TextModule | undefined {
    const moduleNameMatch = this.textModules.find(
      (m) => m.name === searchName || m.fileName === searchName
    );
    // dlog({searchName, moduleNameMatch:moduleNameMatch?.name})
    // dlog({textModules:this.textModules.map(m => m.name)})
    if (moduleNameMatch) return moduleNameMatch;

    const baseSearch = normalize(searchName);
    const pathMatch = this.textModules.find(
      (m) => m.fileName === baseSearch || noSuffix(m.fileName) === baseSearch
    );
    if (pathMatch) return pathMatch;
  }

  private addTextModule(module: TextModule): void {
    this.textModules.push(module); // TODO dedupe?
    module.exports.forEach((e) => {
      const moduleExport: TextModuleExport = {
        module,
        export: e,
        kind: "text"
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
