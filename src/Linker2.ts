import { FnElem, ImportElem, ImportingItem } from "./AbstractElems.js";
import {
  ModuleExport2,
  ModuleRegistry2,
  TextModuleExport2,
} from "./ModuleRegistry2.js";
import { TextExport2, TextModule2, parseModule2 } from "./ParseModule2.js";

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
    importing: new Map(),
    fnDecls: new Set(srcModule.fns.map((fn) => fn.name)),
    renames: new Map(),
    conflicts: 0,
    toLoad: [],
  };
  resolveImportList(srcModule.imports, srcModule, resolveArgs);
  const importedText = exportTexts(resolveArgs.toLoad, resolveArgs.renames);
  return rmImports(srcModule) + "\n\n" + importedText;
}

function exportTexts(toLoad: ToLoad[], renames: RenameMap): string {
  const texts = toLoad.map((l) => {
    if (l.kind === "fn") return loadFnText(l, renames);
    if (l.kind === "export") return loadExportText(l, renames);
    throw new Error("NYI");
  });

  return texts.join("\n\n");
}

type RenameMap = Map<string, Map<string, string>>;

interface ResolveArgs {
  /** load all imports specified in this module */
  srcModule: TextModule2;

  /** find imports in this registry */
  registry: ModuleRegistry2;

  /** import full names already resolved
   * key is the export name with import params,
   * value is the linked name, (possibly export name, or 'as' name, possibly with deconflicted suffix) */
  importing: Map<string, string>;

  /** params provided by the linkWsgl caller */
  extParams: Record<string, any>;

  /** function declarations visible in the linked src so far */
  fnDecls: Set<string>;

  /** number of conflicting names, used as a unique suffix for deconflicting */
  conflicts: number;

  /** Renames per module.
   * In the importing module the key is the 'as' name, the value is the linked name
   * In the export module the key is the export name, the value is the linked name
   */
  renames: RenameMap;

  /** export elements to be copied into the linked output */
  toLoad: ToLoad[];
}

type ToLoad = ToLoadExport | ModuleFn;

interface ModuleFn {
  kind: "fn";
  mod: TextModule2;
  fn: FnElem;
}

interface ToLoadExport {
  kind: "export";
  linkName: string;
  importArgs: string[];
  moduleExport: TextModuleExport2;
}

/*
Renaming for deconfliction
Two modules may internally use the same name for a function, but when linked together, the names must be unique.

We resolve the names of imported functions first before importing/generating text for the importing function, 
so that we can rewrite to deconflicted names if necessary.

We scan through every referenced function declaration, 
including referenced functions in other modules. Every referenced function is assigned a unique
name. 
  . rename map gets an entry for both the importing module and the exporting module
  . toLoad: queue of export fns to load (we'll use rename map to modify them as we load)
  . fnDecls: holds list of all root level function names (after renaming)
  . importing: full name of exports already resolved, mapped to their possibly renamed root name

When we find a request in module A to import a function f as 'g' exported from module B
. We check to see if the 'as' name 'g' is already in use in the linked result (via the fnDecls Set)
  . If there's a conflict, we create a unique name, say f2 
    . we add a rename mapping in A from the 'as' name 'g' to f2
    . we add a rename mapping in B from the export name to the unique name, 'f' to 'f2'

*/

type ToResolve = ImportToResolve | CallToResolve | ImportingToResolve;

interface ImportToResolve {
  kind: "imp";
  imp: ImportElem;
  mod: TextModule2;
}

interface CallToResolve {
  kind: "fn";
  fn: FnElem;
  mod: TextModule2;
}

interface ImportingToResolve {
  kind: "expImp";
  exp: TextExport2;
  importing: ImportingItem;
  mod: TextModule2;
}

function resolveImportList(
  imps: ImportElem[],
  importingModule: TextModule2,
  resolveArgs: ResolveArgs
): void {
  const toResolve: ToResolve[] = imps.flatMap((imp) =>
    resolveImport(imp, importingModule, resolveArgs)
  );

  while (toResolve.length) {
    const todo = toResolve.shift();
    if (!todo) break;

    if (todo.kind === "imp") {
      const { imp, mod } = todo;
      const r = resolveImport(imp, mod, resolveArgs);
      toResolve.push(...r);
    } else if (todo.kind === "fn") {
      const { fn, mod } = todo;
      const r = resolveFn(fn, mod, resolveArgs);
      toResolve.push(...r);
    } else if (todo.kind === "expImp") {
      const { exp, importing, mod } = todo;
      console.log("expImp todokj")
      // const r = resolveExpImporting(exp, importing, mod, resolveArgs);
      // toResolve.push(...r);
    } else {
      console.warn("NYI", todo);
      throw new Error("NYI");
    }
  }
}

/** resolve an import
 *  . find the export requested by this import
 *  . choose a unique name for the exported element, updating the rename map
 *  . update the list of exports to load
 *  . return a list of referenced imports and support fns to resolve later
 */
function resolveImport(
  imp: ImportElem,
  importingModule: TextModule2,
  resolveArgs: ResolveArgs
): ToResolve[] {
  // find and register matching export
  const result = registerImport(imp, importingModule, resolveArgs);
  if (!result) return [];
  const { name: linkName, moduleExport } = result;
  if (moduleExport.kind !== "text") {
    throw new Error("NYI");
  }

  // queue loading of the exported text
  const { toLoad } = resolveArgs;
  const importArgs = imp.args ?? [];
  toLoad.push({ kind: "export", linkName, importArgs, moduleExport });
  const fnElem = moduleExport.export.ref;

  // queue resolution of other imports and fns referenced by the export
  return refsFromFn(fnElem, moduleExport.module);
}

/** resolve a support fn */
function resolveFn(
  fn: FnElem,
  mod: TextModule2,
  resolveArgs: ResolveArgs
): ToResolve[] {
  const result = registerFn(fn, mod, resolveArgs);
  if (!result) return [];

  resolveArgs.toLoad.push({ kind: "fn", mod, fn });

  return refsFromFn(fn, mod);
}

// function resolveExpImporting(
//   exp: TextExport2,
//   importing: ImportingItem,
//   mod: TextModule2,
//   resolveArgs: ResolveArgs
// ): ToResolve[] {
//   const { registry, importing: importingMap, renames } = resolveArgs;
//   const { moduleExport } = exp;
//   const { module: exportingModule } = moduleExport;
//   const { name: expName } = moduleExport.export;

//   const expImp = importingMap.get(expName);
//   if (!expImp) {
//     throw new Error("NYI");
//   }
//   const linkName = importingMap.get(expImp);
//   if (!linkName) {
//     throw new Error("NYI");
//   }

//   // record rename for this import the importing module
//   if (expImp !== linkName) {
//     multiKeySet(renames, mod.name, expImp, linkName);
//   }
//   // record rename for this import in the exporting module
//   if (expName !== linkName) {
//     multiKeySet(renames, exportingModule.name, expName, linkName);
//   }
// }

/**
 * @return true if we haven't seen this fn before */
function registerFn(
  fn: FnElem,
  mod: TextModule2,
  resolveArgs: ResolveArgs
): boolean {
  const { importing, renames } = resolveArgs;
  const fullName = fullSrcElemName(mod.name, fn.name);
  const linkName = importing.get(fullName);
  if (linkName) {
    // we've already registered this elsewhere
    // make sure there's a renaming mapping for this module's import to this
    const verify = renames.get(mod.name)?.get(fn.name);
    console.log("verify fn mapping", verify, ":", linkName);
    return false;
  }

  const uniquedName = registerUniquedName(fn.name, resolveArgs); // DRY with registerImport
  importing.set(fullName, uniquedName);
  if (fn.name !== uniquedName) {
    multiKeySet(renames, mod.name, fn.name, uniquedName);
  }

  return true;
}

interface RegisteredExport {
  name: string;
  moduleExport: ModuleExport2;
}


/**
 * Find the export that matches this import.
 *
 * Find a unique name for this import to appear in the final link
 * Register a rename to the final link name in both the importing and exporting modules.
 *
 * @return the corresponding export if it hasn't been seen before
 */
function registerImport(
  imp: ImportElem,
  impModule: TextModule2,
  resolveArgs: ResolveArgs
): RegisteredExport | null {
  const { registry, importing, renames } = resolveArgs;
  const modEx = findExport(imp, registry);
  if (!modEx) return null; // unexpected error

  const modName = modEx.module.name;
  const expName = fullSrcElemName(modName, modEx.export.name, imp.args);
  const proposedName = importName(imp);

  const linkName = importing.get(expName);
  if (linkName) {
    // we've already registered this export elsewhere
    // make sure there's a renaming mapping for this module's import to this
    multiKeySet(renames, impModule.name, proposedName, linkName);
    return null;
  }

  const exportingModule = modEx.module;
  const uniquedName = registerUniquedName(proposedName, resolveArgs);
  importing.set(expName, uniquedName);

  // record rename for this import the importing module
  if (proposedName !== uniquedName) {
    multiKeySet(renames, impModule.name, proposedName, uniquedName);
  }
  // record rename for this import in the exporting module
  if (imp.name !== modEx.export.name) {
    const expName = modEx.export.name;
    multiKeySet(renames, exportingModule.name, expName, uniquedName);
  }

  return { name: uniquedName, moduleExport: modEx };
}

/**
 *  returns the 
 */
function refsFromFn(fnElem: FnElem, mod: TextModule2): ToResolve[] {
  const calls = fnElem.children.filter((child) => child.kind === "call");

  const toResolve: ToResolve[] = [];
  calls.forEach((callElem) => {
    const imp = mod.imports.find((imp) => imp.name === callElem.call);
    if (imp) {
      toResolve.push({ kind: "imp", imp, mod });
    } else {
      const fn = mod.fns.find((fn) => fn.name === callElem.call);
      if (fn) {
        toResolve.push({ kind: "fn", fn, mod });
      } else {
        let importing: ImportingItem | undefined;
        const exp = mod.exports.find((e) =>
          e.importing.find((imp) => {
            if (imp.importing === callElem.call) {
              importing = imp;
              return true;
            }
          })
        );
        if (exp && importing) {
          toResolve.push({ kind: "expImp", exp, importing, mod });
        } else {
          console.warn("ref not found", callElem, "from module", mod.name);
        }
      }
    }
  });
  return toResolve;
}

/** find an export entry for an import, unless its aready on the importing list */
function findExport(
  imp: ImportElem,
  registry: ModuleRegistry2
): ModuleExport2 | null {
  const moduleExport = registry.getModuleExport(imp.name, imp.from);
  if (!moduleExport) {
    console.error(`#import "${imp.name}" not found position ${imp.start}`); // LATER add source line number
    return null;
  }
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
 */
function loadExportText(load: ToLoadExport, renames: RenameMap): string {
  const { linkName, importArgs, moduleExport } = load;

  const exp = moduleExport.export;

  const { start, end } = exp.ref;

  // TODO here's where we find match import/export arguments
  // we need to match the 'importing' args through one extra layer
  // maybe we could do the matching earlier rather than maintaining the impexp distinction here

  /* replace export args with import arg values */
  const entries: [string, string][] = exp.args.map((p, i) => [
    p,
    importArgs[i],
  ]);
  // rename 'as' imports too, e.g. #import foo as 'newName'
  if (linkName !== exp.name) entries.push([exp.name, linkName]);

  return loadModuleSlice(moduleExport.module, start, end, renames, entries);
}

function loadModuleSlice(
  mod: TextModule2,
  start: number,
  end: number,
  renames: RenameMap,
  replaces: [string, string][] = []
): string {
  const slice = mod.src.slice(start, end);

  const moduleRenames = renames.get(mod.name)?.entries() ?? [];

  // LATER be more precise with replacing e.g. rename for call sites, etc.
  const rewrite = Object.fromEntries([...moduleRenames, ...replaces]);
  return replaceTokens2(slice, rewrite);
}

function loadFnText(moduleFn: ModuleFn, renames: RenameMap): string {
  const { start, end } = moduleFn.fn;
  return loadModuleSlice(moduleFn.mod, start, end, renames);
}

/**
 * Record a fn name, possibly creating a rename mapping to avoid conflict.
 * updates the fnDecls with the uniquified name as this name will appear in the linked result.
 */
function registerUniquedName(
  /** proposed name for this fn in the linked results (e.g. import as name) */
  proposedName: string,
  args: ResolveArgs
): string {
  const { fnDecls } = args;
  let renamed = proposedName;
  if (fnDecls.has(proposedName)) {
    // create a unique name
    while (fnDecls.has(renamed)) {
      renamed = renamed + args.conflicts++;
    }
  }

  fnDecls.add(renamed);
  return renamed;
}

function multiKeySet<A, B, V>(m: Map<A, Map<B, V>>, a: A, b: B, v: V): void {
  const bMap = m.get(a) || new Map();
  m.set(a, bMap);
  bMap.set(b, v);
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

/** @return string of the fn or struct name plus import parameters,
 * for detecting src elements already processed */
function fullSrcElemName(
  moduleName: string,
  elemName: string,
  args: string[] = []
): string {
  return `${moduleName}.${elemName}(${args.join(",")})`;
}
