import { CallElem, ExportElem, FnElem, ImportElem } from "./AbstractElems.js";
import { ModuleExport2, ModuleRegistry2 } from "./ModuleRegistry2.js";
import { TextExport2, TextModule2 } from "./ParseModule2.js";
import { groupBy } from "./Util.js";

export type FoundRef = ExportRef | LocalRef;

export type StringPairs = [string, string][];

export type BothRefs = Partial<Omit<LocalRef, "kind">> &
  Partial<Omit<ExportRef, "kind">> &
  Pick<LocalRef, "fn" | "expMod">;

export interface LocalRef {
  kind: "fn";
  expMod: TextModule2;
  fn: FnElem;
}

export interface ExportRef {
  kind: "exp";
  fromImport: ImportElem;
  impMod: TextModule2;
  expMod: TextModule2;
  expImpArgs: [string, string][];
  fn: FnElem;
}

export function traverseRefs(
  srcModule: TextModule2,
  registry: ModuleRegistry2,
  fn: (ref: FoundRef) => boolean
): void {
  const { fns } = srcModule;
  const expMod = srcModule;
  const refs: FoundRef[] = fns.map((fn) => ({ kind: "fn", expMod, fn }));
  recursiveRefs(refs, srcModule, registry, fn);
}

/*
 * traversal of the wgsl src reference graph:
 *  fn -> calls -> local fn or import+export+fn
 */
export function recursiveRefs(
  srcRefs: FoundRef[],
  mod: TextModule2,
  registry: ModuleRegistry2,
  fn: (ref: FoundRef) => boolean
): void {
  if (!srcRefs.length) return;
  const calls = srcRefs.flatMap((r) => r.fn.children);
  const refs = calls.flatMap((callElem) => {
    const foundRef =
      importRef(callElem, mod, registry) ??
      importingRef(callElem, mod, registry) ??
      localRef(callElem, mod, registry);
    if (!foundRef) {
      console.error("reference not found for:", callElem);
    }
    return foundRef ? [foundRef] : [];
  });

  // run the fn on each ref, and prep to recurse on each ref for which the fn returns true
  const results = refs.filter((r) => fn(r));
  const modGroups = groupBy(results, (r) => r.expMod);
  [...modGroups.entries()].forEach(([m, refs]) => {
    recursiveRefs(refs, m, registry, fn);
  });
}

/** If this call element references an #import function
 * @return an ExportRef describing the export to link */
function importRef(
  callElem: CallElem,
  mod: TextModule2,
  registry: ModuleRegistry2
): ExportRef | undefined {
  const imp = mod.imports.find((imp) => importName(imp) == callElem.call);
  const modExp = matchingExport(imp, mod, registry);
  if (!modExp || !imp) return;
  const expMod = modExp.module as TextModule2;
  const exp = modExp.export as TextExport2;
  const impArgs = imp.args ?? [];
  const expArgs = exp.args ?? [];
  const fn = exp.ref;
  if (expArgs.length !== impArgs.length) {
    console.error("mismatched import and export params", imp, exp);
  }
  const expImpArgs: StringPairs = expArgs.map((p, i) => [p, impArgs[i]]);
  const kind = "exp";
  return { kind, fromImport: imp, impMod: mod, expMod, expImpArgs, fn };
}

/** If this call element references an #export.. importing function
 * @return an ExportRef describing the export to link */
function importingRef(
  callElem: CallElem,
  mod: TextModule2,
  registry: ModuleRegistry2
): ExportRef | undefined {
  let importing: ImportElem | undefined;
  const textExport = mod.exports.find((exp) => {
    console.log("exp", exp);
    importing = exp.importing?.find((i) => i.name === callElem.call);
    return !!importing;
  });
  const modExp = matchingExport(importing, mod, registry);
  if (!modExp) return;
  isDefined(importing);
  isDefined(textExport);

  // how are we going to to get the original import (for its args?)
  const origImport = null as any as ImportElem;
  // we record it with export, but need to propogate it
  //

  const exImpArgs = importingArgs(origImport, textExport, importing);

  return undefined;
}

/**
  * @return the arguments for an importing reference, mapping through the 
  * export and the original import directives.

  * for example:
  *   #import foo(A, B) // import args: A,B
  *   #export foo(C, D) importing bar(D) // exporting args C,D  importing args: D
  * we want to return mapping of D -> B for the importing clasue
   */
function importingArgs(
  imp: ImportElem,
  exp: ExportElem,
  importing: ImportElem
): any {
  const exImpArgs = importing.args ?? [];
}

function isDefined<T>(a: T | undefined): asserts a is T {}

function matchingExport(
  imp: ImportElem | undefined,
  mod: TextModule2,
  registry: ModuleRegistry2
): ModuleExport2 | undefined {
  if (!imp) return;

  const modExp = registry.getModuleExport(imp.name, imp.from);
  if (!modExp) {
    // prettier-ignore
    console.log( "export not found for import", imp.name, "in module:", mod.name, imp.start);
  }
  return modExp;
}

function localRef(
  callElem: CallElem,
  mod: TextModule2,
  registry: ModuleRegistry2
): LocalRef | undefined {
  const fnElem = mod.fns.find((fn) => fn.name === callElem.call);
  if (fnElem) {
    return { kind: "fn", expMod: mod, fn: fnElem };
  }
}

interface AsNamed {
  as?: string;
  name: string;
}

function importName(asNamed: AsNamed): string {
  return asNamed.as || asNamed.name;
}
