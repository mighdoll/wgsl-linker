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
import { ParsedRegistry } from "./ParsedRegistry.js";
import { TextExport, TextModule } from "./ParseModule.js";
import { overlapTail } from "./Util.js";

export interface ResolveMap {
  // map from export path string to resolved export
  exportMap: Map<string, ModuleExport>;
  // map from caller path to exporter path
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
export function importResolutionMap(
  importingModule: TextModule,
  imports: TreeImportElem[],
  registry: ParsedRegistry
): ResolveMap {
  const resolveEntries = imports.flatMap((imp) =>
    resolveTreeImport(importingModule, imp, registry)
  );

  const exportEntries: [string, ModuleExport][] = [];
  const pathEntries: [string[], string[]][] = [];

  resolveEntries.forEach((e) => {
    if (e instanceof ImportToExport) {
      exportEntries.push([e.importPath.join("/"), e.expMod]);
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
  registry: ParsedRegistry
): ResolvedEntry[] {
  return recursiveResolve([], [], imp.imports.segments);

  /** recurse through segments of path, producing  */
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
        return resolveFullPath(impPath, expPath);
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

  function resolveFullPath(
    impPath: string[],
    expPath: string[]
  ): ResolvedEntry[] {
    // try and resolve as an exported element
    const expMod = registry.getModuleExport2(importingModule, expPath);
    if (expMod) {
      return [
        new ImportToExport(impPath, expMod),
        new ImportToExportPath(impPath, expPath),
      ];
    }
    // otherwise return as a module path
    dlog("resolved to Module Path", { impPath, expPath });
    return [new ImportToExportPath(impPath, expPath)];
  }
}
/** resolve an import to an export using the resolveMap
 * @param callPath the reference to the import, e.g. "foo::bar" from
 *    import pkg::foo
 *    fn () { foo::bar(); }
 *
 * Cases: all of these find export path pkg/foo
 *   foo() -> import pkg::foo,
 *   bar() -> import pkg::foo as bar
 *   pkg::foo()  -> import pkg
 *   pkg::foo()  -> import pkg::foo
 *   npkg::foo() -> import pkg as npkg
 *   npkg.foo()  -> import pkg as npkg
 */
export function resolveImport(
  callPath: string,
  resolveMap: ResolveMap
): ModuleExport | undefined {
  const importSegments = callPath.includes("::")
    ? callPath.split("::")
    : callPath.split(".");

  const expPath = impToExportPath(importSegments, resolveMap);
  if (expPath) {
    const exp = resolveMap.exportMap.get(expPath);
    if (exp) {
      return exp;
    }
  }

  return undefined;
}

function impToExportPath(
  impSegments: string[],
  resolveMap: ResolveMap
): string | undefined {
  const { pathsMap } = resolveMap;
  for (const [imp, exp] of pathsMap.entries()) {
    const impTail = overlapTail(imp, impSegments);
    if (impTail) {
      console.assert(imp.length === exp.length);
      const combined = [...exp, ...impTail];
      return combined.join("/");
    }
  }

  return undefined;
}

// export function logResolveMap(resolveMap: ResolveMap): void {
//   const expMap = [...resolveMap.exportMap.entries()].map(([imp, exp]) => {
//     return `${imp} -> ${exp.module.name}/${(exp.exp as TextExport).ref.name}`;
//   });
//   const pathMap = [...resolveMap.pathsMap.entries()].map(([imp, exp]) => {
//     return `${imp.join("/")} -> ${exp.join("/")}`;
//   });
//   dlog({ expMap, pathMap });
// }
