import { ImportElem } from "./AbstractElems.js";
import { fnDecls } from "./Declarations.js";
import {
  ModuleExport2,
  ModuleRegistry2,
  TextModuleExport2,
} from "./ModuleRegistry2.js";
import { TextModule2, parseModule2 } from "./ParseModule2.js";

/** parse source text for #import directives, return wgsl with all imports injected */
export function linkWgsl2(
  src: string,
  registry: ModuleRegistry2,
  extParams: Record<string, any> = {}
): string {
  const srcModule = parseModule2(src);
  const resolveArgs: ResolveArgs = {
    srcModule,
    registry,
    extParams,
    imported: new Map(),
    fnDecls: new Set(srcModule.fns.map((fn) => fn.name)),
    renames: new Map(),
    conflicts: 0,
  };
  const pending: ToResolve[] = [];
  const importedText = srcModule.imports
    .map((imp) => {
      const r = resolveImport(imp, srcModule, resolveArgs);
      if (r) {
        const { text, toResolve } = r;
        pending.push(...toResolve);
        return text;
      }
    })
    

  while (pending.length) {
    const todo = pending.shift();
    if (!todo)  break;
    console.log("pending to import", todo.imp.name, "from", todo.moduleExport.module.name);
    const {imp, moduleExport} = todo;
    if (moduleExport.kind !== "text") throw new Error("NYI");
    const r = resolveImport(imp, moduleExport.module, resolveArgs);
    if (r) {
      const { text, toResolve } = r;
      pending.push(...toResolve);
      importedText.push(text);
    }
  }

  return rmImports(srcModule) + "\n\n" + importedText.join("\n\n");
}

interface ResolveArgs {
  /** load all imports specified in this module */
  srcModule: TextModule2;

  /** find imports in this registry */
  registry: ModuleRegistry2;

  /** import full names already resolved
   * key is the export name with import params,
   * value is the linked name, (possibly export name,  or 'as' name or deconflicted name) */
  imported: Map<string, string>;

  /** params provided by the linkWsgl caller */
  extParams: Record<string, any>;

  /** function declarations visible in the linked src so far */
  fnDecls: Set<string>;

  /** number of conflicting names, used as a unique suffix for deconflicting */
  conflicts: number;

  /** renames per module */
  renames: Map<string, Map<string, string>>;
}

/*
Renaming for deconfliction
Two modules may internally use the same name for a function, but when linked together, the names must be unique.

We resolve the names of imported functions first before importing/generating text for the importing function, 
so that we can rewrite to deconflicted names if necessary.

When we have a request in module A to import a function f as 'g' exported from module B
. First we check to see whether f has already been imported with the same input parameters.
  . If it's already been imported:
    . we don't import any text for the import
    . (if it was renamed, we'll have already caught that earlier, we deconflict names before importing text)
  . If not, we'll import the function text, but with deconfliction checks as follows
. We check to see if the 'as' name 'g' is already in use in the linked result (via the fnDecls Set)
  . If there's a conflict, we create a unique name, say f2 and add it to the fnDecls Set
    . we add a rename mapping in A from the 'as' name 'g' to f2
    . we add a rename mapping in B from the export name to the unique name, 'f' to 'f2'
  . Check all the imports in B referenced by 'f', say 'x' as 'y' from C
    . handle as above, creating rename mappings in B and C
    . queue import of 'x' as 'y' from C
. Import text of f from B
*/

interface ToResolve {
  imp: ImportElem;
  moduleExport: ModuleExport2;
}

interface ResolvedImport {
  text: string;
  toResolve: any[];
}

function resolveImport(
  imp: ImportElem,
  importingModule: TextModule2,
  resolveArgs: ResolveArgs
): ResolvedImport | null {
  const toResolve: ToResolve[] = [];

  // TODO all nested imports will have already been registered, 
  // this calls register again which creates a second name
  
  const result = registerImport(imp, importingModule, resolveArgs);
  if (!result) return null;
  const { name: importingName, moduleExport } = result;
  if (moduleExport.kind !== "text") {
    throw new Error("NYI");
  }

  const nestedImports = importsFromFn(moduleExport);
  nestedImports.forEach((nestedImp) => {
    const registered = registerImport(
      nestedImp,
      moduleExport.module,
      resolveArgs
    );
    if (registered) {
      toResolve.push({ imp: nestedImp, moduleExport: registered.moduleExport });
    }
  });

  const text = loadExportText(imp, moduleExport, resolveArgs);
  return { text, toResolve };
}

interface RegisteredExport {
  name: string;
  moduleExport: ModuleExport2;
}

function registerImport(
  imp: ImportElem,
  impModule: TextModule2,
  resolveArgs: ResolveArgs
): RegisteredExport | null {
  console.log("registerImport", imp.name, "from", impModule.name);
  const { registry, imported, renames } = resolveArgs;
  // if we've already imported this export, we're done
  const moduleExport = findExport(imp, registry, imported);
  if (!moduleExport) return null;

  const exportingModule = moduleExport.module;
  const asName = importName(imp);
  const uniquedName = registerName(asName, resolveArgs);
  if (uniquedName) {
    // record rename for this import in both importing module and exporting module
    multiKeySet(renames, impModule.name, asName, uniquedName);
    multiKeySet(renames, exportingModule.name, imp.name, uniquedName);
  }

  return { name: uniquedName ?? asName, moduleExport };
}

function importsFromFn(expModule: ModuleExport2): ImportElem[] {
  if (expModule.kind === "text") {
    const allImports = expModule.module.imports;
    const fnElem = expModule.export.ref;
    const calls = fnElem.children
      .filter((child) => child.kind === "call")
      .map((callElem) => callElem.call);
    const calledImports = calls.flatMap(
      (name) => allImports.find((imp) => imp.name === name) ?? []
    );
    return calledImports;
  }

  return [];
}

/** find export entry for an import */
function findExport(
  imp: ImportElem,
  registry: ModuleRegistry2,
  imported: Map<string, string>
): ModuleExport2 | null {
  const moduleExport = registry.getModuleExport(imp.name, imp.from);
  if (!moduleExport) {
    console.error(`#import "${imp.name}" not found position ${imp.start}`); // LATER add source line number
    return null;
  }
  const fullName = fullImportName(
    imp.name,
    moduleExport.module.name,
    imp.args ?? []
  );
  if (imported.has(fullName)) return null; // already imported, we're done

  return moduleExport;
}

function importName(imp: ImportElem): string {
  return imp.as || imp.name;
}

/** edit src to remove #import statements for clarity and also because #import
 * statements not in comments will likely cause errors in webgpu webgl parsing */
function rmImports(srcModule: TextModule2): string {
  const src = srcModule.src;
  const startEnds = srcModule.imports.flatMap((imp) => [imp.start, imp.end]);
  const slicePoints = [0, ...startEnds, src.length];
  const edits = grouped(slicePoints, 2);
  return edits.map(([start, end]) => src.slice(start, end)).join("\n");
}

/** extract some exported text from a module, replace export params with corresponding import arguments
 * As a side effect, add the import name to the imported set
 */
function loadExportText(
  importElem: ImportElem,
  moduleExport: TextModuleExport2,
  resolveArgs: ResolveArgs
): string {
  const { renames } = resolveArgs;

  const exp = moduleExport.export;

  const { start, end } = exp.ref;
  const exportSrc = moduleExport.module.src.slice(start, end);

  console.log(renames);
  const as = importName(importElem);
  const renamed = renames.get(moduleExport.module.name)?.entries() ?? [];
  console.log("renamed", renamed);

  /* replace export args with import arg values */
  const importArgs = importElem.args ?? [];
  const entries = exp.args.map((p, i) => [p, importArgs[i]]);
  // rename 'as' imports too, e.g. #import foo as 'newName'
  // if (renamed !== exp.name) entries.push([exp.name, renamed]);
  
  // LATER be more precise with replacing e.g. rename for call sites, etc.
  const importParams = Object.fromEntries([...entries, ...renamed]);
  console.log("exportSrc", exportSrc, importParams);
  return replaceTokens2(exportSrc, importParams);
}

/**
 * Record a fn name, possibly creating a rename mapping to avoid conflict.
 * updates the fnDecls with the uniquified name, and update the rename map as appropriate.
 */
function registerName(
  /** proposed name for this fn in the linked results (e.g. import as name) */
  proposedName: string,
  args: ResolveArgs
  /** renames for this module */
): string | null {
  const { fnDecls } = args;
  let renamed = proposedName;
  if (fnDecls.has(proposedName)) {
    // create a unique name
    while (fnDecls.has(renamed)) {
      renamed = renamed + args.conflicts++;
    }
  }

  fnDecls.add(renamed);
  return renamed === proposedName ? null : renamed;
}

function multiKeySet<A, B, V>(m: Map<A, Map<B, V>>, a: A, b: B, v: V): void {
  const bMap = m.get(a) || new Map();
  m.set(a, bMap);
  bMap.set(b, v);
}

function uniquifyFn(imp: ImportElem, resolveArgs: ResolveArgs): ImportElem {
  const { fnDecls } = resolveArgs;
  const name = imp.as || imp.name;
  // a fn with the same name as the import already exists, so rename it
  let renamed = name;
  while (fnDecls.has(renamed)) {
    renamed = renamed + resolveArgs.conflicts++;
  }
  fnDecls.add(renamed);
  return { ...imp, as: renamed };
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
