import { AbstractElem, FnElem, StructElem } from "./AbstractElems.js";
import { ModuleRegistry2 } from "./ModuleRegistry2.js";
import { TextModule2, parseModule2 } from "./ParseModule2.js";
import {
  BothRefs,
  ExportRef,
  FoundRef,
  LocalRef,
  traverseRefs,
} from "./TraverseRefs.js";
import {
  groupBy,
  grouped,
  multiKeySet,
  partition,
  replaceTokens3,
} from "./Util.js";

export function linkWgsl3(
  src: string,
  registry: ModuleRegistry2,
  extParams: Record<string, any> = {}
): string {
  const srcModule = parseModule2(src);
  const srcElems = [srcModule.fns, srcModule.structs, srcModule.vars].flat();
  const decls = new Set(srcElems.map((e) => e.name));

  const refs = findReferences(srcModule, registry); // all recursively referenced structs and fns
  const renames = uniquify(refs, decls); // construct rename map to make struct and fn names unique at the top level

  // mix the merge refs into the import/export refs
  const { rootMergeRefs, loadRefs } = prepMergeRefs(refs, srcModule);

  // extract export texts, rewriting via rename map and exp/imp args
  const importedText = extractTexts(loadRefs, renames, extParams, registry);

  // construct merge texts for #importMerge
  const root = mergeRootStructs(rootMergeRefs, renames, extParams, registry);
  const { mergedText, origElems } = root;

  /* edit src to remove: 
      . #import statements to not cause errors in wgsl parsing 
      . original structs for which we've created new merged structs
  */
  const slicedSrc = rmElems(src, [...origElems, ...srcModule.imports]); // TODO apply template

  return [slicedSrc, mergedText, importedText].join("\n\n");
}

/** find references to structs and fns we might import */
function findReferences(
  srcModule: TextModule2,
  registry: ModuleRegistry2
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

function refFullName(ref: FoundRef): string {
  const expImpArgs = ref.kind === "exp" ? ref.expImpArgs : [];
  const impArgs = expImpArgs.map(([_, arg]) => arg);
  const argsStr = "(" + impArgs.join(",") + ")";
  return ref.expMod.name + "." + ref.elem.name + argsStr;
}

type RenameMap = Map<string, Map<string, string>>;

/**
 * Calculate and @return a renaming map so that all the found top level elements
 * will have unique, non conflicting names.
 *
 * The rename map includes entries to rename references in both the exporting module
 * and the importing module.
 *
 * @param declaredNames declarations visible in the linked src so far
 */
function uniquify(refs: FoundRef[], declaredNames: Set<string>): RenameMap {
  /** number of conflicting names, used as a unique suffix for deconflicting */
  let conflicts = 0;

  /** Renames per module.
   * In the importing module the key is the 'as' name, the value is the linked name
   * In the export module the key is the export name, the value is the linked name
   */
  const renames: RenameMap = new Map();

  refs.forEach((r) => {
    // name proposed in the importing module (or in the local module for a support fn)
    const proposedName = r.kind === "local" ? r.elem.name : r.proposedName;

    // name we'll actually use in the linked result
    const linkName = uniquifyName(proposedName);
    declaredNames.add(linkName);

    // record rename for this import in the exporting module
    if (linkName !== r.elem.name) {
      multiKeySet(renames, r.expMod.name, r.elem.name, linkName);
    }

    const ref = r as BothRefs;
    // record rename for this import in the importing module
    if (ref.impMod && linkName !== proposedName) {
      multiKeySet(renames, ref.impMod.name, proposedName, linkName);
    }
  });

  return renames;

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

interface MergeAndNonMerge {
  rootMergeRefs: ExportRef[];
  loadRefs: FoundRef[];
}

/** sort through found refs, and attach merge refs to normal export refs
 * so that the export can be rewritten with the merged struct members
 * return the set of export refs and the merge refs for later processing
 */
function prepMergeRefs(
  refs: FoundRef[],
  rootModule: TextModule2
): MergeAndNonMerge {
  const { localRefs, mergeRefs, nonMergeRefs } = partitionRefTypes(refs);
  const expRefs = combineMergeRefs(mergeRefs, nonMergeRefs);
  const loadRefs = [...localRefs, ...expRefs];

  // create refs for the root module in the same form as module refs
  const rawRootMerges = mergeRefs.filter((r) => r.impMod === rootModule);
  const byElem = groupBy(rawRootMerges, (r) => r.fromRef.elem.name);
  const rootMergeRefs = [...byElem.entries()].flatMap(([, merges]) => {
    const fromRef = merges[0].fromRef;
    const synth = syntheticRootExp(rootModule, fromRef);
    const combined = combineMergeRefs(mergeRefs, [synth]);
    return combined;
  });

  return { rootMergeRefs, loadRefs };
}

/** combine export refs with any merge refs for the same element */
function combineMergeRefs(
  mergeRefs: ExportRef[],
  nonMergeRefs: ExportRef[]
): ExportRef[] {
  // map from the element name of a struct annotated with #importMerge to the merge refs
  const mergeMap = new Map<string, ExportRef[]>();
  mergeRefs.forEach((r) => {
    const fullName = refFullName(r.fromRef);
    const merges = mergeMap.get(fullName) || [];
    merges.push(r);
    mergeMap.set(fullName, merges);
  });

  // combine the merge refs into the export refs on the same element
  const expRefs: ExportRef[] = nonMergeRefs.map((ref) => ({
    ...ref,
    mergeRefs: recursiveMerges(ref),
  }));

  return expRefs;

  /** find the importMerges on this element,
   * and recurse to find importMerges on the merging source element */
  function recursiveMerges(ref: ExportRef): ExportRef[] {
    const fullName = refFullName(ref);
    const merges = mergeMap.get(fullName) ?? [];
    const transitiveMerges = merges.flatMap(recursiveMerges);
    return [...merges, ...transitiveMerges];
  }
}

interface RefTypes {
  mergeRefs: ExportRef[];
  nonMergeRefs: ExportRef[];
  localRefs: LocalRef[];
}

function partitionRefTypes(refs: FoundRef[]): RefTypes {
  const [exp, local] = partition(refs, (r) => r.kind === "exp");
  const exportRefs = exp as ExportRef[];
  const [merge, nonMerge] = partition(
    exportRefs,
    (r) => r.fromImport.kind === "importMerge"
  );

  return {
    mergeRefs: merge as ExportRef[],
    nonMergeRefs: nonMerge as ExportRef[],
    localRefs: local as LocalRef[],
  };
}

/** create a synthetic ExportRef so we can treat importMerge on root structs
 * the same as importMerge on exported structs */
function syntheticRootExp(
  rootModule: TextModule2,
  fromRef: FoundRef
): ExportRef {
  const exp: ExportRef = {
    kind: "exp",
    elem: fromRef.elem as StructElem | FnElem,
    expMod: rootModule,
    fromRef,

    proposedName: null as any,
    fromImport: null as any,
    expImpArgs: [],
    impMod: null as any,
  };

  return exp;
}

function extractTexts(
  refs: FoundRef[],
  renames: RenameMap,
  extParams: Record<string, any>,
  registry: ModuleRegistry2
): string {
  return refs
    .map((r) => {
      if (r.kind === "exp" && r.elem.kind === "struct") {
        return loadStruct(r, renames, extParams, registry);
      }
      const replaces = r.kind === "exp" ? r.expImpArgs : [];
      return loadElemText(
        r.elem,
        r.expMod,
        renames,
        replaces,
        extParams,
        registry
      );
    })
    .join("\n\n");
}

function loadStruct(
  r: ExportRef,
  renames: RenameMap,
  extParams: Record<string, any>,
  registry: ModuleRegistry2
): string {
  const replaces = r.kind === "exp" ? r.expImpArgs : [];
  if (!r.mergeRefs || !r.mergeRefs.length)
    return loadElemText(
      r.elem,
      r.expMod,
      renames,
      replaces,
      extParams,
      registry
    );

  const structElem = r.elem as StructElem;

  const rootMembers = structElem.members?.map((m) =>
    loadElemText(m, r.expMod, renames, r.expImpArgs, extParams, registry)
  );

  const newMembers = r.mergeRefs?.flatMap((merge) => {
    const mergeStruct = merge.elem as StructElem;
    return mergeStruct.members?.map((member) =>
      loadElemText(
        member,
        merge.expMod,
        renames,
        merge.expImpArgs,
        extParams,
        registry
      )
    );
  });

  const allMembers = [rootMembers, newMembers].flat().map((m) => "  " + m);
  const membersText = allMembers.join(",\n");
  return `struct ${r.elem.name} {\n${membersText}\n}`;
}

interface MergedText {
  mergedText: string;
  origElems: AbstractElem[];
}

/** re-write root level importMerge structs with members inserted from imported struct */
function mergeRootStructs(
  refs: ExportRef[],
  renames: RenameMap,
  extParams: Record<string, any>,
  registry: ModuleRegistry2
): MergedText {
  const texts = refs.map((r) => loadStruct(r, renames, extParams, registry));
  const origElems = refs.map((r) => r.fromRef.elem);
  return {
    mergedText: texts.join("\n\n"),
    origElems,
  };
}

/** rewrite src with elements removed */
function rmElems(src: String, elems: AbstractElem[]): string {
  const startEnds = [...elems]
    .sort((a, b) => a.start - b.start)
    .flatMap((e) => [e.start, e.end]);

  const slicePoints = [0, ...startEnds, src.length];
  const edits = grouped(slicePoints, 2);
  return edits.map(([start, end]) => src.slice(start, end)).join("\n");
}

/** extract the text for an element a module,
 * optionally replace export params with corresponding import arguments
 * optionally replace fn/struct name with 'import as' name
 */
function loadElemText(
  elem: AbstractElem,
  mod: TextModule2,
  renames: RenameMap,
  replaces: [string, string][],
  extParams: Record<string, any>,
  registry: ModuleRegistry2
): string {
  const { start, end } = elem;
  return loadModuleSlice(
    mod,
    start,
    end,
    renames,
    replaces,
    extParams,
    registry
  );
}

function loadModuleSlice(
  mod: TextModule2,
  start: number,
  end: number,
  /** renaming from uniquificiation */
  renames: RenameMap,
  /** renaming from exp/imp params and as name */
  replaces: [string, string][],
  extParams: Record<string, string>,
  registry: ModuleRegistry2
): string {
  const slice = mod.src.slice(start, end);
  const template = registry.getTemplate(mod.template);
  const templated = template ? template(slice, extParams) : slice;

  const moduleRenames = renames.get(mod.name)?.entries() ?? [];

  // LATER be more precise with replacing e.g. rename for call sites, etc.
  const rewrite = Object.fromEntries([...moduleRenames, ...replaces]);
  return replaceTokens3(templated, rewrite);
}
