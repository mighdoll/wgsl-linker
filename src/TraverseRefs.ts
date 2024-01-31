import { dlog } from "berry-pretty";
import {
  CallElem,
  ExportElem,
  FnElem,
  ImportElem,
  StructElem,
  TypeRefElem,
  VarElem,
} from "./AbstractElems.js";
import { srcErr } from "./LinkerUtil.js";
import { ModuleExport2, ModuleRegistry2 } from "./ModuleRegistry2.js";
import { TextExport2, TextModule2 } from "./ParseModule2.js";
import { groupBy } from "./Util.js";

export type FoundRef = ExportRef | LocalRef;

export type StringPairs = [string, string][];

export type BothRefs = Partial<Omit<LocalRef, "kind">> &
  Partial<Omit<ExportRef, "kind">> &
  Pick<LocalRef, "elem" | "expMod">;

export interface LocalRef {
  kind: "local";
  expMod: TextModule2;
  elem: FnElem | StructElem | VarElem;
}

/** found reference to an exported function or struct */
export interface ExportRef {
  kind: "exp";

  /** module containing the exported funciton */
  expMod: TextModule2;

  /** reference to the exported function or struct */
  elem: FnElem | StructElem;

  /** reference that led us to find this ref (for mapping imp/exp args) */
  fromRef: FoundRef;

  /** import elem that resolved to this export  TODO remove */
  fromImport: ImportElem;

  /** proposed name to use for this export, either fn/struct name or 'as' name from the import.
   * name might still be rewritten by global uniqueness remapping */
  proposedName: string;

  /** module containing the import that requested this export */
  impMod: TextModule2;

  /** mapping from export arguments to import arguments
   * (could be mapping to import args prior to this import, via chain of importing) */
  expImpArgs: [string, string][];
}

/**
 * Recursively walk through all imported references starting from a src module, calling
 * a function with each struct/fn reference found.
 *
 * Note that the reference graph may have multiple reference to the same src element.
 * Return false to avoid recursing into the node.
 * Currently the linker will recurse through the the same node multiple times
 * to handle varied import parameters.  (LATER could be optimized)
 */
export function traverseRefs(
  srcModule: TextModule2,
  registry: ModuleRegistry2,
  fn: (ref: FoundRef) => boolean
): void {
  const { fns, structs, vars } = srcModule;
  const expMod = srcModule;
  const refs: FoundRef[] = [...fns, ...structs, ...vars].map((elem) => ({
    kind: "local",
    expMod,
    elem,
  }));
  recursiveRefs(refs, srcModule, registry, fn);
}

/*
 * traversal of the wgsl src reference graph:
 *  fn -> calls -> (local fn or import+export+fn)
 *  fn -> typeRefs -> (local struct or import+export+struct)
 *  struct -> typeRefs -> (local struct or import+export+struct)
 *  var -> typeRefs -> (local struct or import+export+struct)
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
    return elemRefs(srcRef, mod, registry);
  });

  // run the fn on each ref, and prep to recurse on each ref for which the fn returns true
  const results = refs.filter((r) => fn(r));
  const modGroups = groupBy(results, (r) => r.expMod);
  [...modGroups.entries()].forEach(([m, refs]) => {
    recursiveRefs(refs, m, registry, fn);
  });
}

/** return all struct/fn refs from a src element */
function elemRefs(
  srcRef: FoundRef,
  mod: TextModule2,
  registry: ModuleRegistry2
): FoundRef[] {
  const { elem } = srcRef;
  let fnRefs: FoundRef[] = [];
  if (elem.kind === "fn") {
    fnRefs = elemListRefs(srcRef, elem.calls, mod, registry);
  }
  const userTypeRefs = elem.typeRefs.filter((ref) => !stdType(ref.name));
  const tRefs = elemListRefs(srcRef, userTypeRefs, mod, registry);
  return [...fnRefs, ...tRefs];
}

/** find fn/struct references from children of a fn or struct elem
 * (children being call references and type references from the fn or struct)
 */
function elemListRefs(
  srcRef: FoundRef,
  children: (CallElem | VarElem | StructElem | TypeRefElem)[],
  mod: TextModule2,
  registry: ModuleRegistry2
): FoundRef[] {
  return children.flatMap((elem) => {
    const foundRef =
      importRef(srcRef, elem.name, mod, registry) ??
      importingRef(srcRef, elem.name, mod, registry) ??
      localRef(elem.name, mod);

    if (!foundRef) {
      if (exportArgRef(srcRef, elem.name)) {
        return [];
      }

      const src = srcRef.expMod.src;
      srcErr(src, elem.start, `reference not found`);
      return [];
    }
    return [foundRef];
  });
}

function exportArgRef(srcRef: FoundRef, name: string): boolean | undefined {
  if (srcRef.kind === "exp") {
    return !!srcRef.expImpArgs.find(([expArg]) => expArg === name);
  }
}

/** If this call element references an #import function
 * @return an ExportRef describing the export to link */
function importRef(
  fromRef: FoundRef,
  name: string,
  impMod: TextModule2,
  registry: ModuleRegistry2
): ExportRef | undefined {
  const fromImport = impMod.imports.find((imp) => importName(imp) == name);
  const modExp = matchingExport(fromImport, impMod, registry);
  // dlog({ name, fromImport, modExpModuleName: modExp?.module.name });
  if (!modExp || !fromImport) return;
  const exp = modExp.export as TextExport2;
  const expMod = modExp.module as TextModule2;
  return {
    kind: "exp",
    fromRef,
    fromImport,
    impMod,
    expMod,
    expImpArgs: matchImportExportArgs(impMod, fromImport, expMod, exp),
    elem: exp.ref,
    proposedName: fromImport.as ?? exp.ref.name,
  };
}

function matchImportExportArgs(
  impMod: TextModule2,
  imp: ImportElem,
  expMod: TextModule2,
  exp: ExportElem
): StringPairs {
  const impArgs = imp.args ?? [];
  const expArgs = exp.args ?? [];
  if (expArgs.length !== impArgs.length) {
    srcErr(impMod.src, imp.start, "mismatched import and export params");
    srcErr(expMod.src, exp.start);
  }
  return expArgs.map((p, i) => [p, impArgs[i]]);
}

/** If this call element references an #export.. importing function
 * @return an ExportRef describing the export to link */
function importingRef(
  srcRef: FoundRef,
  name: string,
  impMod: TextModule2,
  registry: ModuleRegistry2
): ExportRef | undefined {
  let fromImport: ImportElem | undefined;
  // find a matching 'importing' phrase in an #export
  const textExport = impMod.exports.find((exp) => {
    fromImport = exp.importing?.find((i) => i.name === name);
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
      elem: exp.ref,
      proposedName: fromImport.as ?? exp.ref.name,
    };
  } else {
    const src = srcRef.expMod.src;
    const pos = srcRef.elem.start;
    srcErr(src, pos, "unexpected srcRef not an export", srcRef.kind);
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
  const expImp = matchImportExportArgs(srcRef.impMod, imp, srcRef.expMod, exp); // X -> D
  const srcExpImp = srcRef.expImpArgs;
  return expImp.flatMap(([iExp, iImp]) => {
    const pair = srcExpImp.find(([srcExpArg]) => srcExpArg === iImp); // D -> B
    if (!pair) {
      const src = srcRef.expMod.src;
      srcErr(src, imp.start, "importing arg doesn't match export");
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
    srcErr(mod.src, imp.start, "export not found for import");
  }
  return modExp;
}

function localRef(name: string, mod: TextModule2): LocalRef | undefined {
  const elem =
    mod.fns.find((fn) => fn.name === name) ??
    mod.structs.find((s) => s.name === name);
  if (elem) {
    return { kind: "local", expMod: mod, elem: elem };
  }
}

interface AsNamed {
  as?: string;
  name: string;
}

function importName(asNamed: AsNamed): string {
  return asNamed.as || asNamed.name;
}

const stdTypes = (
  "array bool f16 f32 i32 " +
  "mat2x2 mat2x3 mat2x4 mat3x2 mat3x3 mat3x4 mat4x2 matrx3 mat4x4 " +
  "u32 vec2 v3c3 vec4"
).split(" ");

/** return true if the name is for a built in type (not a user struct) */
function stdType(name: string): boolean {
  return stdTypes.includes(name);
}
