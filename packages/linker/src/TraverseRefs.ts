import {
  CallElem,
  ExportElem,
  ExtendsElem,
  FnElem,
  ImportElem,
  NamedElem,
  StructElem,
  TypeRefElem,
  VarElem,
} from "./AbstractElems.js";
import { moduleLog, refLog } from "./LinkerLogging.js";
import {
  GeneratorExport,
  GeneratorModule,
  ModuleExport,
  ModuleRegistry,
} from "./ModuleRegistry.js";
import { TextExport, TextModule } from "./ParseModule.js";
import { groupBy } from "./Util.js";

export type FoundRef = TextRef | GeneratorRef;
export type TextRef = ExportRef | LocalRef;

export type StringPairs = [string, string][];

export type PartialRef = Partial<Omit<LocalRef, "kind">> &
  Partial<Omit<ExportRef, "kind">> &
  Partial<Omit<GeneratorRef, "kind" | "expMod">>;

export interface LocalRef {
  kind: "local";
  expMod: TextModule;
  elem: FnElem | StructElem | VarElem;
}

interface ExportRefBase {
  /** reference that led us to find this ref (for mapping imp/exp args) */
  fromRef: FoundRef;

  /** import elem that resolved to this export */
  fromImport: ImportElem | ExtendsElem;

  /** proposed name to use for this export, either fn/struct name or 'as' name from the import.
   * name might still be rewritten by global uniqueness remapping */
  proposedName: string;

  /** mapping from export arguments to import arguments
   * (could be mapping to import args prior to this import, via chain of importing) */
  expImpArgs: [string, string][];
}

export interface GeneratorRef extends ExportRefBase {
  kind: "gen";

  /** module containing the exported function */
  expMod: GeneratorModule;

  /** name of the generated function (may be renamed by import as) */
  name: string;
}

/** found reference to an exported function or struct.
 * describes the links:
 *  from a source element (e.g. CallElem)
 *  -> to an import in the same module
 *  -> to the resolved export in another module
 */
export interface ExportRef extends ExportRefBase {
  kind: "exp";

  /** module containing the exported function */
  expMod: TextModule;

  /** reference to the exported function or struct */
  elem: FnElem | StructElem;

  /** refs to extends elements on this same element
   * (added in a post processing step after traverse) */
  mergeRefs?: ExportRef[]; // CONSIDER make separate type for ExportRef after processing?
}

/**
 * Recursively walk through all imported references starting from a src module, calling
 * a function with each struct/fn reference found.
 *
 * Note that the reference graph may have multiple reference to the same src element.
 * Return false in the provided filter fn to avoid recursing into the node.
 * Currently the linker will recurse through the the same node multiple times
 * to handle varied import parameters.
 */
export function traverseRefs(
  srcModule: TextModule,
  registry: ModuleRegistry,
  fn: (ref: FoundRef) => boolean
): void {
  const { fns, structs, vars } = srcModule;
  const expMod = srcModule;
  const srcRefs: FoundRef[] = [...fns, ...structs, ...vars].map((elem) => ({
    kind: "local",
    expMod,
    elem,
  }));
  if (!srcRefs.length) return;

  // recurse on the external refs from the src root elements
  const nonGenRefs = textRefs(srcRefs);
  const childRefs = nonGenRefs.flatMap((srcRef) =>
    elemRefs(srcRef, srcModule, registry)
  );
  recursiveRefs(childRefs, registry, fn);
}

/*
 * traversal of the wgsl src reference graph as follows:
 *  fn -> calls -> (local fn or import+export+fn)
 *  fn -> typeRefs -> (local struct or import+export+struct)
 *  struct -> typeRefs -> (local struct or import+export+struct)
 *  struct -> extends -> (local struct or import+export+struct)
 *  var -> typeRefs -> (local struct or import+export+struct)
 */
function recursiveRefs(
  refs: FoundRef[],
  registry: ModuleRegistry,
  fn: (ref: FoundRef) => boolean
): void {
  // run the fn on each ref, and prep to recurse on each ref for which the fn returns true
  const filtered = refs.filter((r) => fn(r));

  const nonGenRefs = textRefs(filtered); // we don't need to find imports in generated text

  const modGroups = groupBy(nonGenRefs, (r) => r.expMod);
  [...modGroups.entries()].forEach(([mod, refs]) => {
    if (refs.length) {
      const childRefs = refs.flatMap((r) => elemRefs(r, mod, registry));
      const noRepeats = childRefs.filter((r) => !includesRef(r, refs));
      recursiveRefs(noRepeats, registry, fn);
    }
  });
}

/** @return true if the ref refers to matching ref already found */
function includesRef(r: FoundRef, refs: FoundRef[]): boolean {
  return !!refs.find((a) => matchRef(r, a));
}

/** @return true if the two refs refer to the same named element in the same module */
function matchRef(a: FoundRef, b: FoundRef): boolean {
  if (a.expMod.name !== b.expMod.name) return false;
  if (
    (a.kind === "exp" && b.kind === "exp") ||
    (a.kind === "local" && b.kind === "local")
  ) {
    return a.elem.name == b.elem.name;
  }
  if (a.kind === "gen" && b.kind === "gen") {
    return a.name === b.name;
  }
  return false;
}

// Debug
// function _refName(ref: FoundRef): string {
//   return ref.kind !== "gen" ? ref.elem.name : ref.name;
// }

export function textRefs(refs: FoundRef[]): TextRef[] {
  return refs.filter(textRef);
}

function textRef(ref: FoundRef): ref is TextRef {
  return ref.kind !== "gen";
}

/** return all struct/fn refs from a src element */
function elemRefs(
  srcRef: TextRef,
  mod: TextModule,
  registry: ModuleRegistry
): FoundRef[] {
  const { elem } = srcRef;
  let fnRefs: FoundRef[] = [];
  let mergeRefs: FoundRef[] = [];
  if (elem.kind === "fn") {
    const userCalls = elem.calls.filter(
      (call) => !stdFn(call.name) && call.name !== elem.name
    );
    fnRefs = elemChildrenRefs(srcRef, userCalls, mod, registry);
  } else if (elem.kind === "struct") {
    mergeRefs = extendsRefs(srcRef, elem, mod, registry);
  }
  const userTypeRefs = elem.typeRefs.filter(
    (ref) => !stdType(ref.name) && ref.name !== elem.name
  );
  const tRefs = elemChildrenRefs(srcRef, userTypeRefs, mod, registry);
  return [...fnRefs, ...tRefs, ...mergeRefs];
}

/** find fn/struct references from children of a fn or struct elem
 * (children being call references and type references from the fn or struct) */
function elemChildrenRefs(
  srcRef: TextRef,
  children: (CallElem | VarElem | StructElem | TypeRefElem)[],
  mod: TextModule,
  registry: ModuleRegistry
): FoundRef[] {
  return children.flatMap((elem) => elemRef(elem, srcRef, mod, registry));
}

/** given a source elem that references a struct or fn, return a TextRef linking
 * the src elem to its referent, possibly through an import/export */
function elemRef(
  elem: NamedElem,
  srcRef: TextRef,
  mod: TextModule,
  registry: ModuleRegistry
): FoundRef[] {
  const { name } = elem;
  if (importArgRef(srcRef, name)) return [];

  const foundRef =
    importRef(srcRef, name, mod, registry) ??
    importingRef(srcRef, name, mod, registry) ??
    localRef(name, mod);

  if (foundRef) return [foundRef];

  moduleLog(srcRef.expMod, elem.start, `reference not found: ${name}`);
  return [];
}

/** create references to any extends elements attached to this struct */
function extendsRefs(
  srcRef: TextRef,
  elem: StructElem,
  mod: TextModule,
  registry: ModuleRegistry
): FoundRef[] {
  const merges = elem.extendsElems;
  if (!merges) return [];
  return merges.flatMap((merge) => {
    const foundRef = importRef(srcRef, merge.name, mod, registry);
    if (foundRef) return [foundRef];

    moduleLog(srcRef.expMod, merge.start, `import merge reference not found`);
    return [];
  });
}

/** @return true if the ref is to an import parameter */
function importArgRef(srcRef: FoundRef, name: string): boolean | undefined {
  if (srcRef.kind === "exp") {
    return !!srcRef.expImpArgs.find(([expArg]) => expArg === name);
  }
}

/** If this src element references an #import function
 * @return an ExportRef describing the export to link */
function importRef(
  fromRef: FoundRef,
  name: string,
  impMod: TextModule,
  registry: ModuleRegistry
): ExportRef | GeneratorRef | undefined {
  const fromImport = impMod.imports.find((imp) => importName(imp) == name);
  const modExp = matchingExport(fromImport, impMod, registry);
  if (!modExp || !fromImport) return;
  const expMod = modExp.module;
  if (expMod.kind === "text") {
    const exp = modExp.export as TextExport;
    return {
      kind: "exp",
      fromRef,
      fromImport,
      expMod,
      expImpArgs: matchImportExportArgs(impMod, fromImport, expMod, exp),
      elem: exp.ref,
      proposedName: fromImport.as ?? exp.ref.name,
    };
  } else if (expMod.kind === "generator") {
    const exp = modExp.export as GeneratorExport;
    return {
      kind: "gen",
      fromRef,
      fromImport,
      expMod,
      expImpArgs: matchImportExportArgs(impMod, fromImport, expMod, exp),
      proposedName: fromImport.as ?? exp.name,
      name: exp.name,
    };
  }
}

function matchImportExportArgs(
  impMod: TextModule | GeneratorModule,
  imp: ImportElem | ExtendsElem,
  expMod: TextModule | GeneratorModule,
  exp: ExportElem | GeneratorExport
): StringPairs {
  const impArgs = imp.args ?? [];
  const expArgs = exp.args ?? [];
  if (expArgs.length !== impArgs.length) {
    impMod.kind === "text" &&
      moduleLog(impMod, imp.start, "mismatched import and export params");
    expMod.kind === "text" && moduleLog(expMod, (exp as ExportElem).start);
  }
  return expArgs.map((p, i) => [p, impArgs[i]]);
}

/** If this element references an #export.. importing function
 * @return a ref describing the export to link */
function importingRef(
  srcRef: FoundRef,
  name: string,
  impMod: TextModule,
  registry: ModuleRegistry
): ExportRef | GeneratorRef | undefined {
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

  if (srcRef.kind !== "exp") {
    refLog(srcRef, "unexpected srcRef", srcRef.kind);
    return;
  }

  if (modExp.kind === "text") {
    const exp = modExp.export;
    return {
      kind: "exp",
      fromRef: srcRef,
      fromImport,
      expMod: modExp.module as TextModule,
      expImpArgs: importingArgs(fromImport, exp, srcRef),
      elem: exp.ref,
      proposedName: fromImport.as ?? exp.ref.name,
    };
  } else if (modExp.kind === "function") {
    const exp = modExp.export;
    return {
      kind: "gen",
      fromRef: srcRef,
      fromImport,
      expMod: modExp.module,
      expImpArgs: importingArgs(fromImport, exp, srcRef),
      proposedName: fromImport.as ?? exp.name,
      name: exp.name,
    };
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
  exp: ExportElem | GeneratorExport,
  srcRef: ExportRef
): StringPairs {
  const expImp = matchImportExportArgs(
    srcRef.fromRef.expMod,
    imp,
    srcRef.expMod,
    exp
  ); // X -> D
  const srcExpImp = srcRef.expImpArgs;
  return expImp.flatMap(([iExp, iImp]) => {
    const pair = srcExpImp.find(([srcExpArg]) => srcExpArg === iImp); // D -> B
    if (!pair) {
      moduleLog(srcRef.expMod, imp.start, "importing arg doesn't match export");
      return [];
    }
    const [, impArg] = pair;
    return [[iExp, impArg]] as [string, string][]; // X -> B
  });
}

function isDefined<T>(a: T | undefined): asserts a is T {
  /* */
}

function matchingExport(
  imp: ImportElem | ExtendsElem | undefined,
  mod: TextModule,
  registry: ModuleRegistry
): ModuleExport | undefined {
  if (!imp) return;

  const modExp = registry.getModuleExport(imp.name, imp.from);
  if (!modExp) {
    moduleLog(mod, imp.start, "export not found for import");
  }
  return modExp;
}

function localRef(name: string, mod: TextModule): LocalRef | undefined {
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
const stdFns = `bitcast all any select arrayLength 
  abs acos acosh asin asinh atan atanh atan2 ceil clamp cos cosh 
  countLeadingZeros countOneBits countTrailingZeros cross 
  degrees determinant distance dot dot4UI8Packed dot4I8Packed 
  exp exp2 extractBits faceForward firstLeadingBit firstTrailingBit 
  floor fma fract frexp inserBits inverseSqrt ldexp length log log2
  max min mix modf normalize pow quantizeToF16 radians reflect refract
  reverseBits round saturate sin sinh smoothstep sqrt step tan tanh
  transpose trunc
  dpdx dpdxCoarse dpdxFine dpdy dpdyCoarse dpdyFine fwidth 
  fwdithCoarse fwidthFine
  textureDimensions textureGather textureGatherCompare textureLoad
  textureNumLayers textureNumLevels textureNumSamples
  textureSample textureSampleBias textureSampleCompare textureSampleCompareLevel
  textureSampleGrad textureSampleLevel textureSampleBaseClampToEdge
  textureStore
  atomicLoad atomicStore atomicAdd atomicSub atomicMax atomicMin
  atomicOr atomicXor atomicExchange atomicCompareExchangeWeak
  pack4x8snorm pack4x8unorm pack4xI8 pack4xU8 pack4xI8Clamp pack4xU8Clamp
  pack2x16snorm pack2x16unorm pack2x16float
  unpack4x8snorm unpack4x8unorm unpack4xI8 unpack4xU8 
  unpack2x16snorm unpack2x16unorm unpack2x16float
  storageBarrier textureBarrier workgroupBarrier workgroupUniformLoad
  `.split(/\s+/);

const stdTypes = `array atomic bool f16 f32 i32 
  mat2x2 mat2x3 mat2x4 mat3x2 mat3x3 mat3x4 mat4x2 mat4x3 mat4x4
  mat2x2f mat2x3f mat2x4f mat3x2f mat3x3f mat3x4f
  mat4x2f mat4x3f mat4x4f
  mat2x2h mat2x3h mat2x4h mat3x2h mat3x3h mat3x4h
  mat4x2h mat4x3h mat4x4h
  u32 vec2 vec3 vec4 ptr
  vec2i vec3i vec4i vec2u vec3u vec4u
  vec2f vec3f vec4f vec2h vec3h vec4h
  texture_1d texture_2d texture_2d_array texture_3d 
  texture_cube texture_cube_array
  texture_multisampled texture_depth_multisampled_2d
  texture_external
  texture_storage_1d texture_storage_2d texture_storage_2d_array
  texture_storage_3d
  texture_depth_2d texture_depth_2d_array texture_depth_cube
  texture_depth_cube_array
  sampler sampler_comparison
  `.split(/\s+/);

/** return true if the name is for a built in type (not a user struct) */
function stdType(name: string): boolean {
  return stdTypes.includes(name);
}

export function refName(ref: FoundRef): string {
  return ref.kind === "gen" ? ref.name : ref.elem.name;
}

/** return true if the name is for a built in fn (not a user function) */
function stdFn(name: string): boolean {
  return stdFns.includes(name) || stdType(name);
}
