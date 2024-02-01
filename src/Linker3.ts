import { dlog } from "berry-pretty";
import { FnElem, StructElem, VarElem } from "./AbstractElems.js";
import { ModuleRegistry2 } from "./ModuleRegistry2.js";
import { TextModule2, parseModule2 } from "./ParseModule2.js";
import { BothRefs, FoundRef, traverseRefs } from "./TraverseRefs.js";
import { grouped, multiKeySet, replaceTokens3 } from "./Util.js";

export function linkWgsl3(
  src: string,
  registry: ModuleRegistry2,
  extParams: Record<string, any> = {}
): string {
  const srcModule = parseModule2(src);
  const srcElems = [srcModule.fns, srcModule.structs, srcModule.vars].flat();
  const decls = new Set(srcElems.map(e => e.name));

  const refs = findReferences(srcModule, registry); // all recursively referenced structs and fns 
  const renames = uniquify(refs, decls);

  const importedText = extractTexts(refs, renames);
  return rmImports(srcModule) + "\n\n" + importedText;
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
    const expImpArgs = ref.kind === "exp" ? ref.expImpArgs : [];
    const impArgs = expImpArgs.map(([_, arg]) => arg);
    const argsStr = "(" + impArgs.join(",") + ")";
    const fullName = ref.expMod.name + "." + ref.elem.name + argsStr;

    if (visited.has(fullName)) return false;

    found.push(ref);
    visited.add(fullName);
    return true;
  }
  return found;
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

function extractTexts(refs: FoundRef[], renames: RenameMap): string {
  return refs
    .map((r) => {
      // console.log("extracting:", r.fn.name);
      const replaces = r.kind === "exp" ? r.expImpArgs : [];
      return loadFnOrStructText(r.elem, r.expMod, renames, replaces);
    })
    .join("\n\n");
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

/** extract a function or struct from a module,
 * optionally replace export params with corresponding import arguments
 * optionally replace fn/struct name with 'import as' name
 */
function loadFnOrStructText(
  fn: FnElem | StructElem | VarElem,
  mod: TextModule2,
  renames: RenameMap,
  replaces: [string, string][] = []
): string {
  const { start, end } = fn;
  return loadModuleSlice(mod, start, end, renames, replaces);
}
