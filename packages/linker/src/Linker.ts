import { dlog } from "berry-pretty";
import {
  AbstractElem,
  AliasElem,
  CallElem,
  FnElem,
  StructElem,
  StructMemberElem,
  TypeRefElem,
  VarElem,
} from "./AbstractElems.js";
import { moduleLog, refLog } from "./LinkerLogging.js";
import { ModuleRegistry } from "./ModuleRegistry.js";
import { TextModule } from "./ParseModule.js";
import { SliceReplace, sliceReplace } from "./Slicer.js";
import {
  ExportInfo,
  FoundRef,
  GeneratorRef,
  TextRef,
  refName,
  traverseRefs,
} from "./TraverseRefs.js";
import {
  groupBy,
  grouped,
  mapForward,
  partition,
  replaceWords,
} from "./Util.js";

interface Rewriting {
  extParams: Record<string, string>;
  registry: ModuleRegistry;
}

/**
 * Produce a linked wgsl string with all directives processed
 * (e.g. #import'd functions from other modules are inserted into the resulting string).
 *
 * @param runtimeParams runtime parameters for #import/#export values,
 *  template values, and code generation parameters
 */
export function linkWgslModule(
  srcModule: TextModule,
  registry: ModuleRegistry,
  runtimeParams: Record<string, any> = {}
): string {
  // const { fns, structs, vars, template, preppedSrc } = srcModule;
  // const srcElems = [fns, structs, vars].flat();
  // const decls = new Set(srcElems.map((e) => e.name));
  const decls = new Set<string>();

  const refs = findReferences(srcModule, registry); // all recursively referenced structs and fns
  uniquify(refs, decls); // add rename fields to make struct and fn names unique at the top level

  // mix the merge refs into the import/export refs
  const loadRefs = prepRefsMergeAndLoad(refs);

  // loadRefs.map((r) => printRef(r, "load ref"));

  // extract export texts, rewriting via rename map and exp/imp args
  const rewriting: Rewriting = { extParams: runtimeParams, registry };
  const importedText = extractTexts(loadRefs, rewriting);
  return importedText;

  /* edit orig src to remove: 
      . #import and #module statements (to not cause errors in wgsl parsing if they're not commented out)
      . structs for which we've created new merged structs (we'll append the merged versions at the end)
  */
  // const templateElem = template ? [template] : [];
  // const slicedSrc = rmElems(preppedSrc, [
  //   ...rmRootOrig,
  //   ...srcModule.imports,
  //   ...templateElem,
  // ]);

  // const templatedSrc = applyTemplate(
  //   slicedSrc,
  //   srcModule,
  //   runtimeParams,
  //   registry
  // );

  // if (importedText) return templatedSrc + "\n\n" + importedText;

  // return templatedSrc;
}

/** find references to structs and fns we might import
 * (note that local functions are not listed unless they */
function findReferences(
  srcModule: TextModule,
  registry: ModuleRegistry
): FoundRef[] {
  const visited = new Set<string>();
  const found: FoundRef[] = [];
  traverseRefs(srcModule, registry, handleRef);

  function handleRef(ref: FoundRef): boolean {
    const fullName = refFullName(ref);
    if (visited.has(fullName)) return false;

    found.push(ref);
    visited.add(fullName);
    return true;
  }
  return found;
}

/**
 * unique id for a future root level element in the form:
 *    moduleName.elemName(impParam1, impParam2, ...)
 * We'll eventually give each unique element a unique fn, struct or variable name
 * in the linked source.
 */
function refFullName(ref: FoundRef): string {
  const expImpArgs = ref.expInfo?.expImpArgs ?? [];
  const impArgs = expImpArgs.map(([, arg]) => arg);
  const argsStr = "(" + impArgs.join(",") + ")";
  return ref.expMod.name + "." + refName(ref) + argsStr;
}

export function printRef(r: FoundRef, msg?: string): void {
  const { kind, elem, rename } = r as TextRef;
  dlog(
    msg ?? "",
    {
      kind,
      rename,
    },
    elemToText("elem", elem)
  );
}

export function elemToText(msg: string, elem?: AbstractElem): string {
  if (!elem) return "";
  const { kind, ref: link, name = "" } = elem as CallElem;
  return `${msg}: {kind: ${kind}, name: ${name}, link: ${link !== undefined}}`;
}

/**
 * Calculate rename entries so that all the found top level elements
 * will have unique, non conflicting names.
 *
 * @param declaredNames update global list of root declarations visible in the linked src
 */
function uniquify(refs: FoundRef[], declaredNames: Set<string>): void {
  /** number of conflicting names, used as a unique suffix for deconflicting */
  let conflicts = 0;

  /** Renames per module.
   * In the importing module the key is the 'as' name, the value is the linked name
   * In the export module the key is the export name, the value is the linked name
   */

  refs.forEach((r) => {
    // name we'll actually use in the linked result
    const linkName = uniquifyName(r.proposedName);

    declaredNames.add(linkName);

    // record rename for this import in the reference link
    if (linkName !== refName(r)) {
      if (r.rename) {
        console.error("unexpected: rename already exists", r.rename, linkName);
      }
      r.rename = linkName;
    }
  });

  function uniquifyName(
    /** proposed name for this fn in the linked results (e.g. import as name) */
    proposedName: string
  ): string {
    let renamed = proposedName;
    if (declaredNames.has(proposedName)) {
      // create a unique name
      while (declaredNames.has(renamed)) {
        renamed = renamed + conflicts++;
      }
    }

    return renamed;
  }
}

/**
 * Perpare the refs found in the traverse for loading:
 * . sort through found refs, and attach merge refs to normal export refs
 *   so that the export can be rewritten with the merged struct members
 *
 * @return the set of refs that will be loaded
 */
function prepRefsMergeAndLoad(
  refs: FoundRef[],
): FoundRef[] {
  const { generatorRefs, mergeRefs, nonMergeRefs } = partitionRefTypes(refs);
  const expRefs = combineMergeRefs(mergeRefs, nonMergeRefs);

  return [...generatorRefs, ...expRefs];
}

/** combine export refs with any merge refs for the same element */
function combineMergeRefs(
  mergeRefs: TextRef[],
  nonMergeRefs: TextRef[]
): TextRef[] {
  // map from the element name of a struct annotated with #extends to the merge refs
  const mergeMap = new Map<string, TextRef[]>();
  mergeRefs.forEach((r) => {
    if (r.expInfo) {
      // LATER support merges from local refs too
      const fullName = refFullName(r.expInfo.fromRef);
      const merges = mergeMap.get(fullName) || [];
      merges.push(r);
      mergeMap.set(fullName, merges);
    }
  });

  // combine the merge refs into the export refs on the same element
  const expRefs: TextRef[] = nonMergeRefs.map((ref) => ({
    ...ref,
    mergeRefs: recursiveMerges(ref),
  }));

  return expRefs;

  /** find any extends on this element,
   * and recurse to find any extends on the merging source element */
  function recursiveMerges(ref: TextRef): TextRef[] {
    const fullName = refFullName(ref);
    const merges = mergeMap.get(fullName) ?? [];
    const transitiveMerges = merges.flatMap(recursiveMerges);
    return [...merges, ...transitiveMerges];
  }
}

interface RefTypes {
  mergeRefs: TextRef[];
  nonMergeRefs: TextRef[];
  generatorRefs: GeneratorRef[];
}

/** separate refs into local, gen, merge, and non-merge refs */
function partitionRefTypes(refs: FoundRef[]): RefTypes {
  const txt = refs.filter((r) => r.kind === "txt") as TextRef[];
  const gen = refs.filter((r) => r.kind === "gen") as GeneratorRef[];
  const [merge, nonMerge] = partition(
    txt,
    (r) => r.expInfo?.fromImport.kind === "extends"
  );

  return {
    generatorRefs: gen,
    mergeRefs: merge,
    nonMergeRefs: nonMerge,
  };
}


// TODO what about renaming imported vars or other aliases
function loadOtherElem(ref: TextRef, rewriting: Rewriting): string {
  const { expMod, elem } = ref;
  const typeRefs = (elem as VarElem | AliasElem).typeRefs ?? [];
  const slicing = typeRefSlices(typeRefs);
  const patchedSrc = sliceReplace(
    expMod.preppedSrc,
    slicing,
    elem.start,
    elem.end
  );

  return applyExpImpAndTemplate(patchedSrc, ref, rewriting);
}

function loadGeneratedElem(ref: GeneratorRef, rewriting: Rewriting): string {
  const genExp = ref.expMod.exports.find((e) => e.name === ref.name);
  if (!genExp) {
    refLog(ref, "missing generator", ref.name);
    return "//?";
  }
  const { extParams } = rewriting;

  const fnName = ref.rename ?? ref.proposedName ?? ref.name;
  const expImpEntries = refExpImp(ref, extParams);
  const params = expImpToParams(expImpEntries, extParams);

  const text = genExp?.generate(fnName, params);
  return text;
}

/** load exported text for an import */
function extractTexts(refs: FoundRef[], rewriting: Rewriting): string {
  return refs
    .map((r) => {
      if (r.kind === "gen") {
        return loadGeneratedElem(r, rewriting);
      }
      const elemKind = r.elem.kind;
      if (elemKind === "fn") {
        return loadFnText(r.elem, r, rewriting);
      }
      if (elemKind === "struct") {
        return loadStruct(r, rewriting);
      }
      if (elemKind === "var") {
        return loadOtherElem(r, rewriting);
      }
    })
    .join("\n\n");
}

/** load a struct text, mixing in any elements from #extends */
function loadStruct(ref: TextRef, rewriting: Rewriting): string {
  const structElem = ref.elem as StructElem;

  const rootMembers =
    structElem.members?.map((m) => loadMemberText(m, ref, rewriting)) ?? [];

  const newMembers =
    ref.mergeRefs?.flatMap((mergeRef) => {
      const mergeStruct = mergeRef.elem as StructElem;
      return mergeStruct.members?.map((member) =>
        loadMemberText(member, mergeRef, rewriting)
      );
    }) ?? [];

  const allMembers = [rootMembers, newMembers].flat().map((m) => "  " + m);
  const membersText = allMembers.join(",\n");
  const name = ref.rename || structElem.name;
  return `struct ${name} {\n${membersText}\n}`;
}

// TODO use loadOtherElem?
function loadMemberText(
  member: StructMemberElem,
  ref: TextRef,
  rewriting: Rewriting
): string {
  const { expMod } = ref;
  const slicing = typeRefSlices(member.typeRefs);
  const patchedSrc = sliceReplace(
    expMod.preppedSrc,
    slicing,
    member.start,
    member.end
  );

  return applyExpImpAndTemplate(patchedSrc, ref, rewriting);
}

/** get the export/import param map if appropriate for this ref */
function refExpImp(
  ref: FoundRef,
  extParams: Record<string, string>
): [string, string][] {
  const expImp = ref.expInfo?.expImpArgs ?? [];
  return expImp.map(([exp, imp]) => {
    if (imp.startsWith("ext.")) {
      const value = extParams[imp.slice(4)];
      if (value) return [exp, value];

      refLog(ref, "missing ext param", imp, extParams);
    }
    return [exp, imp];
  });
}

function loadFnText(elem: FnElem, ref: TextRef, rewriting: Rewriting): string {
  const { rename } = ref;
  const slicing: SliceReplace[] = [];

  if (rename) {
    const { start, end } = elem.nameElem;
    slicing.push({ start, end, replacement: rename });
  }

  elem.calls.forEach((call) => {
    const rename = call?.ref?.rename;
    if (rename) {
      const { start, end } = call;
      slicing.push({ start, end, replacement: rename });
    }
  });

  slicing.push(...typeRefSlices(elem.typeRefs));

  const patchedSrc = sliceReplace(
    ref.expMod.preppedSrc,
    slicing,
    elem.start,
    elem.end
  );

  return applyExpImpAndTemplate(patchedSrc, ref, rewriting);
}

/** rewrite the src text according to module templating and exp/imp params */
function applyExpImpAndTemplate(
  src: string,
  ref: TextRef,
  rewriting: Rewriting
): string {
  const { expMod } = ref;
  const { extParams, registry } = rewriting;

  const replaces = refExpImp(ref, extParams);
  const params = expImpToParams(replaces, extParams);
  const templated = applyTemplate(src, expMod, params, registry);

  const rewrite = Object.fromEntries([...replaces]);
  return replaceWords(templated, rewrite);
}

function typeRefSlices(typeRefs: TypeRefElem[]): SliceReplace[] {
  const slicing: SliceReplace[] = [];
  typeRefs.forEach((typeRef) => {
    const rename = typeRef?.ref?.rename;
    if (rename) {
      const { start, end } = typeRef;
      slicing.push({ start, end, replacement: rename });
    }
  });
  return slicing;
}

function expImpToParams(
  expImpEntries: [string, string][],
  extParams: Record<string, string>
): Record<string, string> {
  const expImp = Object.fromEntries(expImpEntries);
  const expImpExt = mapForward(expImp, extParams);
  return { ...extParams, ...expImpExt };
}

function applyTemplate(
  src: string,
  mod: TextModule,
  params: Record<string, any>,
  registry: ModuleRegistry
): string {
  const name = mod.template?.name;
  if (!name) return src;
  const template = registry.getTemplate(name);
  if (!template) {
    moduleLog(
      mod,
      mod.template?.start ?? 0,
      `template '${name}' not found in ModuleRegistry`
    );
  }
  return template ? template(src, params) : src;
}
