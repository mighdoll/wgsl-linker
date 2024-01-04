import { ImportElem } from "./AbstractElems.js";
import { ModuleRegistry2, TextModuleExport2 } from "./ModuleRegistry2.js";
import { TextModule2, parseModule2 } from "./ParseModule2.js";

/** parse source text for #import directives, return wgsl with all imports injected */
export function linkWgsl2(
  src: string,
  registry: ModuleRegistry2,
  extParams: Record<string, any> = {}
): string {
  const srcModule = parseModule2(src);
  const srcNoImports = rmImports(srcModule);
  const importedText = resolveImports({
    srcModule,
    registry,
    extParams,
    imported: new Set(),
    fnDecls: new Set(srcModule.fns.map((fn) => fn.name)),
    conflicts: 0,
  });
  return srcNoImports + "\n\n" + importedText;
}

interface ResolveArgs {
  /** load all imports specified in this module */
  srcModule: TextModule2;

  /** find imports in this registry */
  registry: ModuleRegistry2;

  /** imports already resolved (export name changed possibly changed by 'as', with import params) */
  imported: Set<string>;

  /** params provided by the linkWsgl caller */
  extParams: Record<string, any>;

  /** function declarations visible in the linked src so far */
  fnDecls: Set<string>;

  /** number of conflicting names, used as a unique suffix for deconflicting */
  conflicts: number;
}

/** load all the imports from a module, recursively loading imports from imported modules */
function resolveImports(args: ResolveArgs): string {
  const { fnDecls, srcModule, registry } = args;
  const toResolve: TextModule2[] = [];
  console.log("fnDecls", fnDecls);

  // note: we import breadth first so that parent fn names take precedence

  // collect text from direct imports
  const importedTexts = srcModule.imports.flatMap((imp) => {
    const moduleExport = registry.getModuleExport(imp.name, imp.from);
    if (!moduleExport) {
      console.error(`#import "${imp.name}" not found position ${imp.start}`); // LATER add source line number
      return [];
    } else if (moduleExport.kind === "text") {
      const exportText = loadExportText(imp, moduleExport, args);
      console.log("exportText", exportText);
      toResolve.push(moduleExport.module);
      return [exportText];
    } else {
      throw new Error("NYI");
    }
  });

  // collect text from imported module imports
  const nestedImports = toResolve.map((m) =>
    resolveImports({ ...args, srcModule: m })
  );
  return [...importedTexts, nestedImports].join("\n\n");
}

/** edit src to remove #imports */
function rmImports(srcModule: TextModule2): string {
  const src = srcModule.src;
  const startEnds = srcModule.imports.flatMap((imp) => [imp.start, imp.end]);
  const slicePoints = [0, ...startEnds, src.length];
  const edits = grouped(slicePoints, 2);
  return edits.map(([start, end]) => src.slice(start, end)).join("\n");
}

/** extract some exported text from a module, replace export params with corresponding import arguments */
function loadExportText(
  importElem: ImportElem,
  exporting: TextModuleExport2,
  resolveArgs: ResolveArgs
): string {
  const { imported } = resolveArgs;

  const exp = exporting.export;
  // save the import name so we can deduplicate

  const { as = exp.name } = importElem;
  const { args = [] } = importElem;
  const fullName = fullImportName(as, exporting.module.name, args);
  if (imported.has(fullName)) {
    return ""; // already imported, we're done
  }
  imported.add(fullName);

  const { start, end } = exp.ref;
  const exportSrc = exporting.module.src.slice(start, end);

  const renamed = uniqueFnName(as, resolveArgs);

  // TODO how to rename calls to the new name?

  /* replace export args with import arg values */
  const importArgs = importElem.args ?? [];
  const entries = exp.args.map((p, i) => [p, importArgs[i]]);
  // rename 'as' imports too, e.g. #import foo as 'newName'
  if (renamed !== exp.name) entries.push([exp.name, renamed]);
  const importParams = Object.fromEntries(entries);
  return replaceTokens2(exportSrc, importParams);

  // TODO load referenced calls from the imported text..
  // see exp.ref.children
}

function uniqueFnName(fnName: string, resolveArgs: ResolveArgs): string {
  const { fnDecls } = resolveArgs;
  // a fn with the same name as the import already exists, so rename it
  let renamed = fnName;
  while (fnDecls.has(renamed)) {
    renamed = renamed + resolveArgs.conflicts++;
  }
  if (renamed !== fnName) {
    fnDecls.add(renamed);
  }
  return renamed;
}

const tokenRegex = /\b(\w+)\b/gi;
export function replaceTokens2(
  text: string,
  replace: Record<string, string>
): string {
  return text.replaceAll(tokenRegex, (s) => (s in replace ? replace[s] : s));
}

/** return an array partitioned into possibly overlapping groups */
function grouped<T>(a: T[], size: number, stride = size): T[][] {
  const groups = [];
  for (let i = 0; i < a.length; i += stride) {
    groups.push(a.slice(i, i + size));
  }
  return groups;
}

/** @return string of a named import with parameters, for deduplication */
function fullImportName(
  moduleName: string,
  importName: string,
  params: string[]
): string {
  return `${moduleName}.${importName}(${params.join(",")})`;
}
