import { SrcMap } from "mini-parse";
import { linkWgslModule } from "./Linker.js";
import { parseModule, TextExport, TextModule } from "./ParseModule.js";
import { normalize, noSuffix, relativePath } from "./PathUtil.js";
import { multiKeySet } from "./Util.js";
import { dlog } from "berry-pretty";
import { ParsedModules } from "./ParsedModules.js";

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
) => SrcMap;

/** a single export from a module */
export type ModuleExport = TextModuleExport | GeneratorModuleExport;

export interface TextModuleExport {
  module: TextModule;
  exp: TextExport; 
  kind: "text";
}

export interface GeneratorModule {
  kind: "generator";
  name: string;
  exports: GeneratorExport[];
}

export interface GeneratorModuleExport {
  module: GeneratorModule;
  exp: GeneratorExport;
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
}

/**
 * A ModuleRegistry collects exportable code fragments, code generator functions,
 * and template processors.
 *
 * The ModuleRegistry provides everything required for linkWgsl to process
 * #import statements and generate a complete wgsl shader.
 */
export class ModuleRegistry {

  templates = new Map<string, ApplyTemplateFn>();
  wgslSrc = new Map<string, string>();
  generators = new Map<string, GeneratorModule>();

  constructor(args?: RegistryParams) {
    if (!args) return;
    const { wgsl = {}, rawWgsl = [], templates = [], generators } = args;

    Object.entries(wgsl).forEach(([fileName, src]) =>
      this.addModuleSrc(src, fileName)
    );
    rawWgsl.forEach((src) => this.addModuleSrc(src));
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
    return this.parsed(runtimeParams).link(moduleName);
  }
  
  parsed(runtimeParams: Record<string, any> = {}): ParsedModules {
    return new ParsedModules(this, runtimeParams);
  }

  addModuleSrc(src: string, fileName?: string): void {
    if (fileName) {
      this.wgslSrc.set(normalize(fileName), src);
    } else {
      this.wgslSrc.set(`rawWgsl-${unnamedTextDex++}`, src);
    }
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
    
    this.generators.set(module.name, module)
  }

  /** register a template processor  */
  registerTemplate(...templates: Template[]): void {
    templates.forEach((t) => this.templates.set(t.name, t.apply));
  }

  /** fetch a template processor */
  getTemplate(name: string): ApplyTemplateFn | undefined {
    return this.templates.get(name);
  }

}
