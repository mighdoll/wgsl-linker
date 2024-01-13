import {
  CallElem,
  FnElem,
  ImportElem,
  ImportingItem,
} from "./AbstractElems.js";
import {
  ModuleExport2,
  ModuleRegistry2,
  TextModuleExport2,
} from "./ModuleRegistry2.js";
import { TextExport2, TextModule2, parseModule2 } from "./ParseModule2.js";
import { dlog, dlogOpt } from "berry-pretty";
import { FoundRef, recursiveRefs } from "./TraverseRefs.js";
import { grouped, replaceTokens3 } from "./Util.js";

export function linkWgsl3(
  src: string,
  registry: ModuleRegistry2,
  extParams: Record<string, any> = {}
): string {
  const srcModule = parseModule2(src);
  const refs = findReferences(srcModule, registry);
  const renames = uniquify(refs);
  const importedText = extractTexts(refs, renames);
  // const importedText = exportTexts(resolveArgs.toLoad, resolveArgs.renames);
  return rmImports(srcModule) + "\n\n" + importedText;
}

function findReferences(
  srcModule: TextModule2,
  registry: ModuleRegistry2
): FoundRef[] {
  const visited = new Set<string>();
  const found: FoundRef[] = [];
  recursiveRefs(srcModule.fns, srcModule, registry, handleRef);

  function handleRef(ref: FoundRef): boolean {
    const expImpArgs = ref.kind === "exp" ? ref.expImpArgs : [];
    const impArgs = expImpArgs.map(([_, arg]) => arg);
    const argsStr = "(" + impArgs.join(",") + ")";
    const fullName = ref.expMod.name + "." + ref.fn.name + argsStr;

    if (visited.has(fullName)) return false;

    found.push(ref);
    visited.add(fullName);
    return true;
  }
  return found;
}

type RenameMap = Map<string, Map<string, string>>;

function uniquify(refs: FoundRef[]): RenameMap {
  /** function declarations visible in the linked src so far */
  const fnDecls = new Set<string>();

  /** number of conflicting names, used as a unique suffix for deconflicting */
  let conflicts = 0;

  /** Renames per module.
   * In the importing module the key is the 'as' name, the value is the linked name
   * In the export module the key is the export name, the value is the linked name
   */
  const renames: RenameMap = new Map();

  return renames;
}

function extractTexts(refs: FoundRef[], renames: RenameMap): string {
  return refs
    .map((r) => {
      // console.log("extracting:", r.fn.name);
      const replaces = r.kind === "exp" ? r.expImpArgs : [];
      return loadFnText(r.fn, r.expMod, renames, replaces);
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
  /** renaming from exp/imp params  and as name */
  replaces: [string, string][] = []
): string {
  const slice = mod.src.slice(start, end);

  const moduleRenames = renames.get(mod.name)?.entries() ?? [];

  // LATER be more precise with replacing e.g. rename for call sites, etc.
  const rewrite = Object.fromEntries([...moduleRenames, ...replaces]);
  return replaceTokens3(slice, rewrite);
}

/** extract a function from a module,
 * optionally replace export params with corresponding import arguments
 * optionally replace fn name with 'import as' name
 */
function loadFnText(
  fn: FnElem,
  mod: TextModule2,
  renames: RenameMap,
  replaces: [string, string][] = []
): string {
  const { start, end } = fn;
  return loadModuleSlice(mod, start, end, renames, replaces);
}
