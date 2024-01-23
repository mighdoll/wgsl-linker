import { dlog, dlogOpt } from "berry-pretty";
import { CallElem, ExportElem, FnElem, ImportElem } from "./AbstractElems.js";
import { ModuleExport2, ModuleRegistry2 } from "./ModuleRegistry2.js";
import { TextExport2, TextModule2 } from "./ParseModule2.js";
import { groupBy } from "./Util.js";
import { logErr } from "./LinkerUtil.js";

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

/** found reference to an exported function */
export interface ExportRef {
  kind: "exp";

  /** module containing the exported funciton */
  expMod: TextModule2;

  /** reference to the exported function  */
  fn: FnElem;

  /** reference that led us to find this ref (for mapping imp/exp args) */
  fromRef: FoundRef;

  /** import elem that resolved to this export  TODO remove */
  fromImport: ImportElem;

  /** proposed name to use for this export, either fn name or 'as' name from the import.
   * name might still be rewritten by global uniqueness remapping */
  proposedName: string;

  /** module containing the import that requested this export */
  impMod: TextModule2;

  /** mapping from export arguments to import arguments
   * (could be mapping to import args prior to this import, via chain of importing) */
  expImpArgs: [string, string][];
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
  const refs = srcRefs.flatMap((srcRef) => {
    // find a reference for each call in each srcRef
    return srcRef.fn.children.flatMap((callElem) => {
      const foundRef =
        importRef(srcRef, callElem.call, mod, registry) ??
        importingRef(srcRef, callElem, mod, registry) ??
        localRef(callElem, mod, registry);
      if (!foundRef) {
        logErr("reference not found for:", callElem);
        srcRef.expMod.src
      }
      return foundRef ? [foundRef] : [];
    });
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
  fromRef: FoundRef,
  fnName: string,
  impMod: TextModule2,
  registry: ModuleRegistry2
): ExportRef | undefined {
  const fromImport = impMod.imports.find((imp) => importName(imp) == fnName);
  const modExp = matchingExport(fromImport, impMod, registry);
  if (!modExp || !fromImport) return;
  const exp = modExp.export as TextExport2;
  return {
    kind: "exp",
    fromRef,
    fromImport,
    impMod,
    expMod: modExp.module as TextModule2,
    expImpArgs: matchImportExportArgs(fromImport, exp),
    fn: exp.ref,
    proposedName: fromImport.as ?? exp.ref.name,
  };
}

function matchImportExportArgs(imp: ImportElem, exp: ExportElem): StringPairs {
  const impArgs = imp.args ?? [];
  const expArgs = exp.args ?? [];
  if (expArgs.length !== impArgs.length) {
    logErr("mismatched import and export params", imp, exp);
  }
  return expArgs.map((p, i) => [p, impArgs[i]]);
}

/** If this call element references an #export.. importing function
 * @return an ExportRef describing the export to link */
function importingRef(
  srcRef: FoundRef,
  callElem: CallElem,
  impMod: TextModule2,
  registry: ModuleRegistry2
): ExportRef | undefined {
  let fromImport: ImportElem | undefined;
  // find a matching 'importing' phrase in an #export
  const textExport = impMod.exports.find((exp) => {
    fromImport = exp.importing?.find((i) => i.name === callElem.call);
    return !!fromImport;
  });
  // find the export for the importing
  const modExp = matchingExport(fromImport, impMod, registry);
  if (!modExp) return;
  isDefined(fromImport);
  isDefined(textExport);

  if (srcRef.kind === "exp") {
    const exp = modExp.export as TextExport2;

    return {
      kind: "exp",
      fromRef: srcRef,
      fromImport,
      impMod,
      expMod: modExp.module as TextModule2,
      expImpArgs: importingArgs(fromImport, exp, srcRef),
      fn: exp.ref,
      proposedName: fromImport.as ?? exp.ref.name,
    };
  } else {
    // prettier-ignore
    logErr("unexpected srcRef not an export", srcRef, "for", callElem, textExport, fromImport);
  }

  return undefined;
}

/**
 * @return the arguments for an importing reference, mapping through the
 * export and the original import directives.
 *
 * e.g. we're tracking a fn call that references through an 'importing':
 *   import1 -> export2 -> importing3 -> export4
 * and we want to find the mapping from export4 args to import1 args
 *
 * for example:
 *   #import foo(A, B)
 *   #export foo(C, D) importing bar(D)
 *   #export bar(X)
 * we want to return mapping of X -> B for the importing clasue
 *
 * @param imp - the importing clause
 * @param exp - export matching the importing clause
 * @param srcRef - reference that led us to this import
 */
function importingArgs(
  imp: ImportElem,
  exp: ExportElem,
  srcRef: ExportRef
): StringPairs {
  const expImp = matchImportExportArgs(imp, exp); // X -> D
  const srcExpImp = srcRef.expImpArgs;
  return expImp.flatMap(([iExp, iImp]) => {
    const pair = srcExpImp.find(([srcExpArg]) => srcExpArg === iImp); // D -> B
    if (!pair) {
      logErr("importing arg doesn't match", imp, exp, srcRef);
      return [];
    }
    const [, impArg] = pair;
    return [[iExp, impArg]] as [string, string][]; // X -> B
  });
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
    logErr( "export not found for import", imp.name, "in module:", mod.name, imp.start);
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
