import { TreeImportElem } from "./AbstractElems.js";
import { importResolutionMap, ResolveMap } from "./ImportResolutionMap.js";
import { linkWgslModule } from "./Linker.js";
import {
  GeneratorExport,
  GeneratorModule,
  GeneratorModuleExport,
  ModuleExport,
  ModuleRegistry,
  TextModuleExport,
} from "./ModuleRegistry.js";
import { parseModule, TextExport, TextModule } from "./ParseModule.js";
import { normalize, noSuffix, relativePath } from "./PathUtil.js";

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
    fileName: string
  ): void {
    const newFileName = fileName && normalize(fileName);
    const m = parseModule(src, this.registry.templates, newFileName, params);
    this.addTextModule(m);
  }

  /** return a reference to an exported text fragment or code generator (i.e. in response to an #import request) */
  getModuleExportOld(
    // TODO rm
    requesting: TextModule,
    exportName: string,
    moduleSpecifier?: string // either a module name or a relative path
  ): ModuleExport | undefined {
    const exports = this.exports.get(exportName);
    if (!exports) {
      return undefined;
    } else if (moduleSpecifier?.startsWith(".")) {
      const searchName = relativePath(requesting.fileName, moduleSpecifier);
      const baseSearch = noSuffix(searchName);

      return exports.find((e) => {
        const fileName = (e.module as TextModule).fileName;
        if (!fileName) return false;
        if (fileName === searchName) return true;
        if (baseSearch === noSuffix(fileName)) return true;
      });
    } else if (moduleSpecifier) {
      return exports.find((e) => e.module.name === moduleSpecifier);
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

    // TODO cache
    return importResolutionMap(importingModule, treeImports, this);
  }

  /** @return a ModuleExport if the provided pathSegments
   * reference an export in a registered module */
  getModuleExport2(
    importingModule: TextModule,
    pathSegments: string[]
  ): ModuleExport | undefined {
    if (pathSegments[0] === ".") {
      // TODO handle relative path
    } else {
      const modulePath = pathSegments.slice(0, -1).join("/");
      const expName = pathSegments[pathSegments.length - 1];
      const module = this.findTextModule(modulePath); // TODO also find generator modules
      const exp = module?.exports.find((e) => e.ref.name === expName);
      if (exp) {
        return { module, exp: exp } as TextModuleExport;
      }
    }
  }

  findModule(
    moduleSpecifier: string
  ): TextModule | GeneratorModule | undefined {
    return (
      this.findTextModule(moduleSpecifier) ??
      this.registry.generators.get(moduleSpecifier)
    );
  }

  /** find a text module by module name or file name */
  findTextModule(moduleSpecifier: string): TextModule | undefined {
    // const fileNames = this.textModules.map((m) => m.fileName);
    // const names = this.textModules.map((m) => m.name);
    // dlog({ searchName: moduleSpecifier, fileNames, names });
    const exactMatch = this.textModules.find(
      (m) => m.name === moduleSpecifier || m.fileName === moduleSpecifier
    );
    if (exactMatch) return exactMatch;

    const baseSearch = normalize(moduleSpecifier);
    const pathMatch = this.textModules.find(
      (m) => m.fileName === baseSearch || noSuffix(m.fileName) === baseSearch
    );
    if (pathMatch) return pathMatch;
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
