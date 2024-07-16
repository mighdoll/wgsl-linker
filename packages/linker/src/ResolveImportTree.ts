import { dlog } from "berry-pretty";
import { TreeImportElem } from "./AbstractElems.js";
import {
  ImportTree,
  PathSegment,
  SegmentList,
  SimpleSegment,
  Wildcard,
} from "./ImportTree.js";
import { ModuleExport } from "./ModuleRegistry.js";
import { ParsedModules } from "./ParsedModules.js";
import { TextModule } from "./ParseModule.js";

export interface ResolveMap {
  // map from import path to resolved export
  exportMap: Map<string[], ModuleExport>;
  // map from import path to export path
  pathsMap: Map<string[], string[]>;
}

/* we could be bringing two different things into scope when we import mymod::foo
 * 1) an exported function, used as foo()
 * 2) a module, used as foo::bar()  (or foo.bar())
 *
 * We can't tell which one it is until we see the caller.
 *
 * As we process imports, we partially resolve now,
 * and flatten wildcards and segment lists.
 *
 * These entries will be converted into a ResolveMap
 */
type ResolvedEntry = ImportToExport | ImportToExportPath;
class ImportToExport {
  constructor(
    public importPath: string[],
    public expMod: ModuleExport
  ) {}
}

class ImportToExportPath {
  constructor(
    public importPath: string[],
    public exportPath: string[]
  ) {}
}

/** Expand all imports to their corresponding exported element (fn, struct var),
 * or to their corresponding export module.
 * Wildcards and path lists are fully expanded, so the result is
 * a flat list of single import paths to single export paths.
 *
 * @returns a map from import path to either a resolved export element
 *  or to an export path
 *
 * The export path will hopefully resolve to an exported element later when
 * combined a reference site suffix, e.g.:
 *    import pkg::a as b      // pkg::b -> pkg::a     map import path to export path
 *    fn foo() { b::bar(); }  // can now resolve to exported element pkg::a::bar
 */
export function resolveImports(
  importingModule: TextModule,
  imports: TreeImportElem[],
  registry: ParsedModules
): ResolveMap {
  const resolveEntries = imports.flatMap((imp) =>
    resolveTreeImport(importingModule, imp, registry)
  );

  const exportEntries: [string[], ModuleExport][] = [];
  const pathEntries: [string[], string[]][] = [];

  resolveEntries.forEach((e) => {
    if (e instanceof ImportToExport) {
      exportEntries.push([e.importPath, e.expMod]);
    } else {
      pathEntries.push([e.importPath, e.exportPath]);
    }
  });

  return {
    exportMap: new Map(exportEntries),
    pathsMap: new Map(pathEntries),
  };
}

function resolveTreeImport(
  importingModule: TextModule,
  imp: TreeImportElem,
  registry: ParsedModules
): ResolvedEntry[] {
  return recursiveResolve([], [], imp.imports.segments);

  function recursiveResolve(
    resolvedImportPath: string[],
    resolvedExportPath: string[],
    remainingPath: PathSegment[]
  ): ResolvedEntry[] {
    const [segment, ...rest] = remainingPath;
    if (segment === undefined) {
      return [];
    }
    if (segment instanceof SimpleSegment) {
      const impPath = [...resolvedImportPath, segment.as || segment.name];
      const expPath = [...resolvedExportPath, segment.name];
      if (rest.length) {
        // we're in the middle of the path so keep recursing
        return recursiveResolve(impPath, expPath, rest);
      } else {
        // try and resolve as an exported element
        const expMod = registry.getModuleExport2(importingModule, expPath);
        if (expMod) {
          // dlog("resolved to Export", { impPath, expPath });
          return [new ImportToExport(impPath, expMod)];
        }
        // otherwise return as a module path
        dlog("resolved to Module Path", { impPath, expPath });
        return [new ImportToExportPath(impPath, expPath)];
      }
    }
    if (segment instanceof SegmentList) {
      // resolve path with each element in the list
      return segment.list.flatMap((elem) =>
        recursiveResolve(resolvedImportPath, resolvedExportPath, [
          elem,
          ...rest,
        ])
      );
    }
    if (segment instanceof Wildcard) {
      // TODO
      return [];
    } else if (segment instanceof ImportTree) {
      // TODO
      return [];
    }
    console.error("unknown segment type", segment); // should be impossible
    return [];
  }
}

/** resolve an import to an export using the resolveMap
 * @param importPath the reference to the import, e.g. "foo::bar" from
 *    import pkg::foo
 *    fn () { foo::bar(); }
 */
export function matchImport(
  importPath: string,
  resolveMap: ResolveMap
): ModuleExport | undefined {
  const importSegments = importPath.includes("::")
    ? importPath.split("::")
    : importPath.split(".");

  // match case where import path points directly to an export entry
  const fullPathMatch = matchFullExport(importSegments, resolveMap);
  if (fullPathMatch) {
    return fullPathMatch;
  }

  // match case where import path extends an path entry (TODO testme)
  for (const [, partialExpPath] of resolveMap.pathsMap.entries()) {
    const combinedImpPath = [...partialExpPath, ...importSegments];
    const combinedMatch = matchFullExport(combinedImpPath, resolveMap);
    if (combinedMatch) {
      return combinedMatch;
    }
  }

  return undefined;
}

function matchFullExport(
  impSegments: string[],
  resolveMap: ResolveMap
): ModuleExport | undefined {
  for (const [fullImpPath, exp] of resolveMap.exportMap.entries()) {
    if (arrayEquals(fullImpPath, impSegments)) {
      return exp;
    }
  }
}

function arrayEquals(a: any[], b: any[]): boolean {
  return a.length === b.length && a.every((val, index) => val === b[index]);
}
