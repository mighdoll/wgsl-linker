import { dlog } from "berry-pretty";
import { AbstractElem, FnElem, StructElem, VarElem } from "./AbstractElems.js";
import { ModuleRegistry2 } from "./ModuleRegistry2.js";
import { TextModule2, parseModule2 } from "./ParseModule2.js";
import { BothRefs, ExportRef, FoundRef, traverseRefs } from "./TraverseRefs.js";
import { grouped, multiKeySet, partition, replaceTokens3 } from "./Util.js";

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

  const { mergeRefs, loadRefs } = prepMergeRefs(refs);
  const rootMergeRefs = mergeRefs.filter(
    (r) => r.kind === "exp" && r.impMod === srcModule
  );

  // extract export texts, rewriting via rename map and exp/imp args
  const importedText = extractTexts(loadRefs, renames);

  // construct merge texts for #importMerge
  const { mergedText, origElems } = mergeTexts(rootMergeRefs, renames);

  /* edit src to remove: 
      . #import statements to not cause errors in wgsl parsing 
      . original structs for which we've created new merged structs
  */
  const slicedSrc = rmElems(src, [...origElems, ...srcModule.imports]);

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
  mergeRefs: FoundRef[];
  loadRefs: FoundRef[];
}

function prepMergeRefs(refs: FoundRef[]): MergeAndNonMerge {
  const [e, localRefs] = partition(refs, (r) => r.kind === "exp");
  const exportRefs = e as ExportRef[];
  const [m, n] = partition(
    exportRefs,
    (r) => r.fromImport.kind === "importMerge"
  );
  const mergeRefs = m as ExportRef[];
  const nonMergeRefs = n as ExportRef[];

  // map from the full name of a struct annotated with #importMerge to the merge refs
  const mergeElems = new Map<string, ExportRef[]>();
  mergeRefs.forEach((r) => {
    const fullName = refFullName(r.fromRef);
    const merges = mergeElems.get(fullName) || [];
    merges.push(r);
    mergeElems.set(fullName, merges);
  });

  nonMergeRefs.forEach((r) => {
    const fullName = refFullName(r);
    const merges = mergeElems.get(fullName) || [];
    r.mergeRefs = merges;
  });

  const loadRefs = [...localRefs, ...nonMergeRefs];

  return { mergeRefs, loadRefs };
}

function extractTexts(refs: FoundRef[], renames: RenameMap): string {
  return refs
    .map((r) => {
      if (r.kind === "exp" && r.elem.kind === "struct") {
        return loadStruct(r, renames);
      }
      const replaces = r.kind === "exp" ? r.expImpArgs : [];
      return loadElemText(r.elem, r.expMod, renames, replaces);
    })
    .join("\n\n");
}

interface MergedText {
  mergedText: string;
  origElems: AbstractElem[];
}

function loadStruct(r: ExportRef, renames: RenameMap): string {
  const replaces = r.kind === "exp" ? r.expImpArgs : [];
  if (!r.mergeRefs || !r.mergeRefs.length ) return loadElemText(r.elem, r.expMod, renames, replaces);

  const structElem = r.elem as StructElem;

  const rootMembers = structElem.members?.map((m) =>
    loadElemText(m, r.expMod, renames, r.expImpArgs)
  );

  const newMembers = r.mergeRefs?.flatMap((merge) => {
    // TODO recursively load struct members if merge.elem also has #importMerges
    const mergeStruct = merge.elem as StructElem;
    return mergeStruct.members?.map((member) =>
      loadElemText(member, merge.expMod, renames, merge.expImpArgs)
    );
  });

  const allMembers = [rootMembers, newMembers].flat().map((m) => "  " + m);
  const membersText = allMembers.join(",\n");
  return `struct ${r.elem.name} {\n${membersText}\n}`;
}

/** re-write importMerge'd structs with members inserted from imported struct */
function mergeTexts(refs: FoundRef[], renames: RenameMap): MergedText {
  const origElems: AbstractElem[] = [];
  const newStructs = refs.map((r) => {
    const ref = r as ExportRef;
    const newElem = r.elem as StructElem;
    const rootElem = ref.fromRef.elem as StructElem;
    origElems.push(rootElem);

    const newMembers = newElem.members?.map((m) =>
      loadElemText(m, r.expMod, renames)
    );
    const rootMembers = rootElem.members?.map((m) =>
      loadElemText(m, ref.fromRef.expMod, renames)
    );
    const allMembers = [rootMembers, newMembers].flat().map((m) => "  " + m);
    const membersText = allMembers.join(",\n");
    return `struct ${rootElem.name} {\n${membersText}\n}`;
  });
  return {
    mergedText: newStructs.join("\n\n"),
    origElems,
  };
}

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
  replaces: [string, string][] = []
): string {
  const { start, end } = elem;
  return loadModuleSlice(mod, start, end, renames, replaces);
}

function loadModuleSlice(
  mod: TextModule2,
  start: number,
  end: number,
  /** renaming from uniquificiation */
  renames: RenameMap,
  /** renaming from exp/imp params and as name */
  replaces: [string, string][] = []
): string {
  const slice = mod.src.slice(start, end);

  const moduleRenames = renames.get(mod.name)?.entries() ?? [];

  // LATER be more precise with replacing e.g. rename for call sites, etc.
  const rewrite = Object.fromEntries([...moduleRenames, ...replaces]);
  return replaceTokens3(slice, rewrite);
}
