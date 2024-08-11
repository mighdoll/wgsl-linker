import { dlog } from "berry-pretty";
import { ExportElem, TreeImportElem } from "./AbstractElems.js";
import {
  ImportTree,
  PathSegment,
  SegmentList,
  SimpleSegment,
  Wildcard,
} from "./ImportTree.js";
import { GeneratorExport, GeneratorModule, ModuleExport } from "./ModuleRegistry.js";
import { exportName, ParsedRegistry } from "./ParsedRegistry.js";
import { TextModule } from "./ParseModule.js";
import { StringPairs } from "./TraverseRefs.js";
import { moduleLog } from "./LinkerLogging.js";

export interface ResolveMap {
  // map from export path string "mypkg/foo/bar/exp" to resolved export
  exportMap: Map<string, ImportToExport>;

  // map from caller path to exporter path ["pkg", "subpath", "asName"] -> ["mypkg", "subpath", "expName"]
  pathsMap: Array<[string[], string[]]>; 
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
    public expMod: ModuleExport,
    public expImpArgs: StringPairs
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
 * a flat list of single import paths to single export paths or export elements.
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

  const exportEntries: [string, ImportToExport][] = [];
  const pathEntries: [string[], string[]][] = [];

  resolveEntries.forEach((e) => {
    if (e instanceof ImportToExport) {
      exportEntries.push([e.importPath.join("/"), e]);
    } else {
      pathEntries.push([e.importPath, e.exportPath]);
    }
  });

  return {
    exportMap: new Map(exportEntries),
    pathsMap: pathEntries,
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
    // dlog({ segment, resolvedImportPath, resolvedExportPath });
    if (segment === undefined) {
      throw new Error(`undefined segment ${imp.imports.segments}`);
    }
    if (segment instanceof SimpleSegment) {
      const impPath = [...resolvedImportPath, segment.as || segment.name];
      const expPath = [...resolvedExportPath, segment.name];
      if (rest.length) {
        // we're in the middle of the path so keep recursing
        return recursiveResolve(impPath, expPath, rest);
      } else {
        return resolveFullPath(impPath, expPath, segment.args);
      }
    }
    if (segment instanceof SegmentList) {
      // resolve path with each element in the list
      return segment.list.flatMap((elem) => {
        const result = recursiveResolve(
          resolvedImportPath,
          resolvedExportPath,
          [elem, ...rest]
        );
        return result;
      });
    }
    if (segment instanceof Wildcard) {
      const modulePath = resolvedExportPath.join("/");
      const m = registry.findModule(modulePath);
      if (m) {
        return wildCardExports(m, resolvedImportPath, resolvedExportPath);
      } else {
        console.error("no module found", modulePath); // LATER point to source location in error
      }
      return [];
    } else if (segment instanceof ImportTree) {
      return recursiveResolve(
        resolvedImportPath,
        resolvedExportPath,
        segment.segments
      );
    }

    console.error("unknown segment type", segment); // should be impossible
    return [];
  }

  function wildCardExports(
    m: GeneratorModule | TextModule,
    resolvedImportPath: string[],
    resolvedExportPath: string[]
  ): ResolvedEntry[] {
    const exportKind = m.kind === "generator" ? "function" : "text";
    return m.exports.flatMap((e) => {
      const expPath = [...resolvedExportPath, exportName(e)];
      const impPath = [...resolvedImportPath, exportName(e)];
      const modExp = {
        kind: exportKind,
        module: m,
        exp: e,
      } as ModuleExport;
      return [
        new ImportToExportPath(impPath, expPath),
        new ImportToExport(impPath, modExp, []),
      ];
    });
  }

  function resolveFullPath(
    impPath: string[],
    expPath: string[],
    impArgs: string[] | undefined
  ): ResolvedEntry[] {
    const entries: ResolvedEntry[] = [new ImportToExportPath(impPath, expPath)];

    // try and resolve as an exported element as well
    const expMod = registry.getModuleExport2(importingModule, expPath);
    if (expMod) {
      const expImpArgs = matchExportImportArgs(
        importingModule,
        imp,
        impArgs ?? [],
        expMod.module,
        expMod.exp
      );
      entries.push(new ImportToExport(impPath, expMod, expImpArgs));
    }
    return entries;
  }
}

function matchExportImportArgs(
  impMod: TextModule | GeneratorModule,
  imp: TreeImportElem,
  impArgs: string[],
  expMod: TextModule | GeneratorModule,
  exp: ExportElem | GeneratorExport
): StringPairs {
  const expArgs = exp.args ?? [];
  if (expArgs.length !== impArgs.length) {
    impMod.kind === "text" &&
      moduleLog(impMod, imp.start, "mismatched import and export params");
    expMod.kind === "text" && moduleLog(expMod, (exp as ExportElem).start);
  }
  return expArgs.map((p, i) => [p, impArgs[i]]);
}
