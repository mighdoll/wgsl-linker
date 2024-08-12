import { dlog } from "berry-pretty";
import { TreeImportElem } from "./AbstractElems.js";
import { importResolutionMap, ResolveMap } from "./ImportResolutionMap.js";
import { linkWgslModule } from "./Linker.js";
import {
  GeneratorExport,
  GeneratorModule,
  GeneratorModuleExport,
  ModuleExport,
  relativeToAbsolute,
  ModuleRegistry,
  TextModuleExport,
} from "./ModuleRegistry.js";
import { parseModule, TextExport, TextModule } from "./ParseModule.js";
import { dirname, normalize, noSuffix, relativePath } from "./PathUtil.js";

/** parse wgsl files and provided indexed access to modules and exports */
export class ParsedRegistry {
  // map from module path with / separators, to module
  private moduleMap = new Map<string, TextModule | GeneratorModule>();

  private textModules: TextModule[] = [];

  // map from export names to a map of module names to exports // TODO rm
  private exports = new Map<string, ModuleExport[]>();

  constructor(
    public registry: ModuleRegistry,
    public conditions: Record<string, any> = {}
  ) {
    this.textModules = [];
    this.registry.wgslSrc.forEach((src, fileName) => {
      this.parseOneModule(src, conditions, fileName);
    });
    this.recordGenerators();
  }

  link(moduleSpecifier: string): string {
    const module = this.findTextModule(moduleSpecifier);
    if (!module) {
      throw new Error(`Module not found: ${moduleSpecifier}`);
    }
    return linkWgslModule(module, this, this.conditions);
  }

  /** parse one module, register exports for later searching */
  private parseOneModule(
    src: string,
    params: Record<string, any> = {},
    modulePath: string
  ): void {
    const m = parseModule(src, this.registry.templates, modulePath, params);
    this.addTextModule(m);
  }

  // TODO rm Old
  /** return a reference to an exported text fragment or code generator (i.e. in response to an #import request) */
  getModuleExportOld(
    requesting: TextModule,
    exportName: string,
    moduleSpecifier?: string // either a module name or a relative path
  ): ModuleExport | undefined {
    return undefined;
    // const exports = this.exports.get(exportName);
    // if (!exports) {
    //   return undefined;
    // } else if (moduleSpecifier?.startsWith(".")) {
    //   const searchName = relativePath(requesting.fileName, moduleSpecifier);
    //   const baseSearch = noSuffix(searchName);

    //   return exports.find((e) => {
    //     const fileName = (e.module as TextModule).fileName;
    //     if (!fileName) return false;
    //     if (fileName === searchName) return true;
    //     if (baseSearch === noSuffix(fileName)) return true;
    //   });
    // } else if (moduleSpecifier) {
    //   return exports.find((e) => e.module.name === moduleSpecifier);
    // } else if (exports.length === 1) {
    //   return exports[0];
    // } else {
    //   const moduleNames = exports.map((e) => e.module.name).join(", ");
    //   console.warn(
    //     `Multiple modules export "${exportName}". (${moduleNames}) ` +
    //       `Use "#import ${exportName} from <moduleName>" to select which one import`
    //   );
    // }
  }

  // TODO drop this?  It's only used for tests
  moduleByPath(
    pathSegments: string[]
  ): TextModule | GeneratorModule | undefined {
    return this.moduleMap.get(pathSegments.join("/"));
  }

  /** @return a ResolveMap to make it easier to resolve imports from the provided module */
  importResolveMap(importingModule: TextModule): ResolveMap {
    const treeImports: TreeImportElem[] = importingModule.imports.filter(
      (i) => i.kind === "treeImport"
    ); // TODO drop filter when we drop other import kinds

    // LATER cache?
    return importResolutionMap(importingModule, treeImports, this);
  }

  /** @return a ModuleExport if the provided pathSegments
   * reference an export in a registered module */
  getModuleExport2(
    importingModule: TextModule, // TODO drop this and require pathSegments to be absolute
    pathSegments: string[]
  ): ModuleExport | undefined {
    const exportName = pathSegments[pathSegments.length - 1];
    if (pathSegments[0] === ".") {
      // relative module path in current package
      const moduleDir = dirname(importingModule.modulePath);
      const joined = [moduleDir, ...pathSegments.slice(1, -1)].join("/");
      const modulePath = normalize(joined);
      const result = this.findExport(modulePath, exportName);
      dlog({ modulePath, exportName, result: !!result });
      return result;
    } else {
      // package rooted path
      const modulePath = pathSegments.slice(0, -1).join("/");
      return this.findExport(modulePath, exportName);
    }
  }

  private findExport(
    modulePath: string,
    exportName: string
  ): TextModuleExport | GeneratorModuleExport | undefined {
    const module = this.findTextModule(modulePath);
    dlog({ modulePath, module: !!module });
    const exp = module?.exports.find((e) => e.ref.name === exportName);
    if (exp) {
      return { module, exp: exp } as TextModuleExport;
    }
    // TODO also find generator modules / exports
  }

  findModule(
    moduleSpecifier: string
  ): TextModule | GeneratorModule | undefined {
    return (
      this.findTextModule(moduleSpecifier) ??
      this.registry.generators.get(moduleSpecifier)
    );
  }

  /**
   * Find a text module by module specifier
   * @param packageName requesting package name (for resolving relative paths)
   */
  findTextModule(
    moduleSpecifier: string,
    packageName = "_root"
  ): TextModule | undefined {
    // const modulePaths = this.textModules.map((m) => m.modulePath);
    // dlog({ modulePaths });
    const resolvedPath = moduleSpecifier.startsWith(".")
      ? relativeToAbsolute(moduleSpecifier, packageName)
      : moduleSpecifier;
    const result =
      this.textModules.find((m) => m.modulePath === resolvedPath) ??
      this.textModules.find((m) => noSuffix(m.modulePath) === resolvedPath);
    dlog({ moduleSpecifier, packageName, result: !!result });
    return result;
  }

  // TODO just register modules, drop exports based index
  private recordGenerators(): void {
    this.registry.generators.forEach((g) => {
      const moduleExport: GeneratorModuleExport = {
        module: g,
        exp: g.exports[0],
        kind: "function",
      };
      this.addModuleExport(moduleExport);
    });
  }

  private addTextModule(module: TextModule): void {
    this.textModules.push(module);
    this.moduleMap.set(module.name, module);
    module.exports.forEach((e) => {
      const moduleExport: TextModuleExport = {
        module,
        exp: e,
        kind: "text",
      };
      this.addModuleExport(moduleExport);
    });
  }

  private addModuleExport(moduleExport: ModuleExport): void {
    const expName = moduleExportName(moduleExport);
    const existing = this.exports.get(expName);
    if (existing) {
      existing.push(moduleExport);
    } else {
      this.exports.set(expName, [moduleExport]);
    }
  }
}

function moduleExportName(moduleExport: ModuleExport): string {
  return exportName(moduleExport.exp);
}

export function exportName(exp: TextExport | GeneratorExport): string {
  // TODO make TextExport into a class or give kinds to avoid unsound casts
  const asTextExport = exp as TextExport;
  const asGenExport = exp as GeneratorExport;
  return asTextExport.ref?.name ?? asGenExport.name;
}