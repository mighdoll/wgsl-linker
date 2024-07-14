import { resolve } from "path";
import { TreeImportElem } from "./AbstractElems.js";
import {
  ImportTree,
  PathSegment,
  SegmentList,
  SimpleSegment,
  Wildcard,
} from "./ImportTree.js";
import { ModuleExport, ModuleRegistry } from "./ModuleRegistry.js";
import { TextExport, TextModule } from "./ParseModule.js";
import { dlog } from "berry-pretty";
import { ParsedModules } from "./ParsedModules.js";

export type ResolvedMap = Map<string[], ResolvedExport>;
export type ResolvedExport = ExportPath | ResolvedExportElement;

/** import path mapped to an export path.
 * note that the export path is not validated, it may not correspond to the
 * path of an actual module in the registry.
 */
export class ExportPath {
  constructor(public exportPath: string[]) {}
}

/** import path mapped to an exported element in a module in the registry. */
export class ResolvedExportElement {
  constructor(public expMod: ModuleExport) {}
}

export function resolvedToString(resolved: ResolvedMap): string {
  return [...resolved.entries()]
    .map(([imp, exp]) => resolvedEntryToString(imp, exp))
    .join("\n");
}

function resolvedEntryToString(
  importPath: string[],
  exp: ResolvedExport
): string {
  if (exp instanceof ResolvedExportElement) {
    const exportName = (exp.expMod.exp as TextExport).ref.name;
    return `impExp: ${importPath.join("/")} -> ${exp.expMod.module.name}/${exportName}`;
  } else {
    return `impMod: ${importPath.join("/")} -> ${exp.exportPath.join("/")}`;
  }
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
): ResolvedMap {
  const entries = imports.flatMap((imp) =>
    resolveTreeImport(importingModule, imp, registry)
  );
  const resolvedEntries = entries.map((e) => {
    const value =
      e instanceof ImportToExport
        ? new ResolvedExportElement(e.expMod)
        : new ExportPath(e.exportPath);
    return [e.importPath, value] as [string[], ResolvedExport];
  });
  return new Map(resolvedEntries);
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
        // TODO try and resolve as an exported element
        // otherwise return as a module path
        const expMod = registry.getModuleExport2(importingModule, expPath);
        if (expMod) {
          // dlog("resolved to Export", { impPath, expPath });
          return [new ImportToExport(impPath, expMod)];
        }
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
      return [];
    } else if (segment instanceof ImportTree) {
      return [];
    }
    console.error("unhandled segment", segment); // should be impossible
    return [];
  }
}
