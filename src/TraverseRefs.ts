import { CallElem, FnElem, ImportElem } from "./AbstractElems.js";
import { ModuleRegistry2 } from "./ModuleRegistry2.js";
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

/*
 * traversal of the wgsl src reference graph:
 *  fn -> calls -> local fn or import+export+fn
 *
 */
export function recursiveRefs(
  srcElems: FnElem[],
  mod: TextModule2,
  registry: ModuleRegistry2,
  fn: (ref: FoundRef) => boolean
): void {
  if (!srcElems.length) return;
  const calls = srcElems.flatMap((fn) => fn.children);
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
    const fnElems = refs.map((r) => r.fn);
    recursiveRefs(fnElems, m, registry, fn);
  });
}

// we need to find and report 'importing' refs.
// should we attach them to an existin ExportRef or make a new entry?
// let's try making a new entry, and then we can handle the arg matching here

/** If this call element references an #import function
 * @return an ExportRef describing the export to link */
function importRef(
  callElem: CallElem,
  mod: TextModule2,
  registry: ModuleRegistry2
): ExportRef | undefined {
  const imp = mod.imports.find((imp) => importName(imp) == callElem.call);
  if (imp) {
    const kind = "exp";

    const modExp = registry.getModuleExport(imp.name, imp.from);
    if (!modExp) {
      // prettier-ignore
      console.log( "export not found for import", imp.name, "in module:", mod.name, imp.start);
      return;
    }
    const expMod = modExp.module as TextModule2;
    const exp = modExp.export as TextExport2;
    const impArgs = imp.args ?? [];
    const fn = exp.ref;
    if (exp.args.length !== impArgs.length) {
      console.error("mismatched import and export params", imp, exp);
    }
    const expImpArgs: StringPairs = exp.args.map((p, i) => [p, impArgs[i]]);
    return { kind, fromImport: imp, impMod: mod, expMod, expImpArgs, fn };
  }
}

/** If this call element references an #export.. importing function
 * @return an ExportRef describing the export to link */
function importingRef(
  callElem: CallElem,
  mod: TextModule2,
  registry: ModuleRegistry2
): ExportRef | undefined {
  return undefined;
  // mod.exports.find(e => {
  //   e.importing.find(i => i.importing === )
  // })
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
  name:string;
}

function importName(asNamed: AsNamed): string {
  return asNamed.as || asNamed.name;
}
