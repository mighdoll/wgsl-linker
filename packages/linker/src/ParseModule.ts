import { srcLog, SrcMap } from "mini-parse";
import {
  AbstractElem,
  AliasElem,
  ExportElem,
  ExtendsElem,
  FnElem,
  GlobalDirectiveElem,
  ImportElem,
  ModuleElem,
  StructElem,
  TemplateElem,
  VarElem,
} from "./AbstractElems.js";
import { processConditionals } from "./Conditionals.js";
import { ApplyTemplateFn } from "./ModuleRegistry.js";
import { parseWgslD } from "./ParseWgslD.js";
import { SliceReplace, sliceReplace } from "./Slicer.js";

/** module with exportable text fragments that are optionally transformed by a templating engine */
export interface TextModule {
  kind: "text";
  template?: TemplateElem;
  exports: TextExport[];
  fns: FnElem[];
  vars: VarElem[];
  structs: StructElem[];
  imports: (ImportElem | ExtendsElem)[];
  aliases: AliasElem[];
  globalDirectives: GlobalDirectiveElem[];

  /** name of the module. A synthetic name will be assigned if none is provided */
  name: string;

  /** name of the module. A synthetic file name will be assigned if none is provided */
  fileName: string;

  /** original src for module */
  src: string;

  /** src code after processing #if conditionals  */
  preppedSrc: string;

  /** tracks changes through conditional processing for error reporting */
  srcMap: SrcMap;
}

/** an export elem annotated with the fn/struct to which it refers */
export interface TextExport extends ExportElem {
  ref: FnElem | StructElem;
}

let unnamedModuleDex = 0;
let unnamedFileDex = 0;

export function preProcess(
  src: string,
  params: Record<string, any> = {},
  templates: Map<string, ApplyTemplateFn> = new Map()
): SrcMap {
  const condSrcMap = processConditionals(src, params);
  return applyTemplate(condSrcMap, templates, params);
}

export function parseModule(
  src: string,
  templates: Map<string, ApplyTemplateFn> = new Map(),
  fileName = `/unnamed-${unnamedFileDex++}`,
  params: Record<string, any> = {},
  defaultModuleName?: string
): TextModule {
  const srcMap = preProcess(src, params, templates);

  const preppedSrc = srcMap.dest;
  const parsed = parseWgslD(preppedSrc, srcMap);
  const exports = findExports(parsed, srcMap);
  const fns = filterElems<FnElem>(parsed, "fn");
  const aliases = filterElems<AliasElem>(parsed, "alias");
  const globalDirectives = filterElems<GlobalDirectiveElem>(
    parsed,
    "globalDirective"
  );
  const imports = parsed.filter(
    (e) => e.kind === "import" || e.kind === "extends"
  ) as (ImportElem | ExtendsElem)[];
  const structs = filterElems<StructElem>(parsed, "struct");
  const vars = filterElems<VarElem>(parsed, "var");
  const template = filterElems<TemplateElem>(parsed, "template")?.[0];
  matchMergeImports(parsed, srcMap);
  const moduleName = filterElems<ModuleElem>(parsed, "module")[0]?.name;
  matchMergeImports(parsed, srcMap);

  const name = moduleName ?? defaultModuleName ?? `module${unnamedModuleDex++}`;
  const kind = "text";
  return {
    ...{ kind, src, srcMap, preppedSrc, fileName, name },
    ...{
      exports,
      fns,
      structs,
      vars,
      imports,
      template,
      aliases,
      globalDirectives,
    },
  };
}

export function filterElems<T extends AbstractElem>(
  parsed: AbstractElem[],
  kind: T["kind"]
): T[] {
  return parsed.filter((e) => e.kind === kind) as T[];
}

function findExports(parsed: AbstractElem[], srcMap: SrcMap): TextExport[] {
  const results: TextExport[] = [];
  const exports = findKind<ExportElem>(parsed, "export");

  exports.forEach(([elem, i]) => {
    let next: AbstractElem | undefined;
    do {
      next = parsed[++i];
    } while (next?.kind === "extends");
    if (elem.kind === "export") {
      if (next?.kind === "fn" || next?.kind === "struct") {
        results.push({ ...elem, ref: next });
      } else {
        srcLog(srcMap, elem.start, `#export what? (#export a fn or struct)`);
      }
    }
  });
  return results;
}

/** fill in extendsElem field of structs */
function matchMergeImports(parsed: AbstractElem[], srcMap: SrcMap): void {
  const extendsElems = findKind<ExtendsElem>(parsed, "extends");
  extendsElems.forEach(([extendsElem, i]) => {
    let next: AbstractElem | undefined;
    do {
      next = parsed[++i];
    } while (next?.kind === "extends" || next?.kind === "export");
    if (next?.kind === "struct") {
      next.extendsElems = next.extendsElems ?? [];
      next.extendsElems.push(extendsElem);
    } else {
      srcLog(srcMap, extendsElem.start, `#extends not followed by a struct`);
    }
  });
}

function findKind<T extends AbstractElem>(
  parsed: AbstractElem[],
  kind: T["kind"]
): [T, number][] {
  return parsed.flatMap((elem, i) =>
    elem.kind === kind ? ([[elem, i]] as [T, number][]) : []
  );
}

const templateRegex = /#template\s+([/[a-zA-Z_][\w./-]*)/;

function applyTemplate(
  priorSrcMap: SrcMap,
  templates: Map<string, ApplyTemplateFn>,
  params: Record<string, any>
): SrcMap {
  const src = priorSrcMap.dest;
  const foundTemplate = src.match(templateRegex);
  if (!foundTemplate) {
    return priorSrcMap;
  }
  const templateName = foundTemplate[1];
  const templateFn = templates.get(templateName);
  if (!templateFn) {
    srcLog(
      priorSrcMap,
      foundTemplate.index!,
      `template '${templateName}' not found in ModuleRegistry`
    );
    return priorSrcMap;
  }

  // dlog({priorSrcMap})

  const start = foundTemplate.index!;
  const end = start + foundTemplate[0].length;
  const rmDirective: SliceReplace = { start, end, replacement: "" };
  const removedMap = sliceReplace(src, [rmDirective]);
  // dlog({ removedMap });
  const removeMerged = priorSrcMap.merge(removedMap);
  // dlog({ removeMerged });

  const templatedMap = templateFn(removeMerged.dest, params);
  // dlog({ templatedMap});

  const srcMap = removeMerged.merge(templatedMap);
  // dlog({ srcMap });

  return srcMap;
}
