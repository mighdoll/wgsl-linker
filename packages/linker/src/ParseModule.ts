import {
  AbstractElem,
  ExportElem,
  FnElem,
  ImportElem,
  ExtendsElem,
  ModuleElem,
  StructElem,
  TemplateElem,
  VarElem,
} from "./AbstractElems.js";
import { processConditionals } from "./Conditionals.js";
import { parseWgslD } from "./ParseWgslD.js";
import { srcLog, SrcMap } from "mini-parse";

/** module with exportable text fragments that are optionally transformed by a templating engine */
export interface TextModule {
  kind: "text";
  template?: TemplateElem;
  exports: TextExport[];
  fns: FnElem[];
  vars: VarElem[];
  structs: StructElem[];
  imports: (ImportElem | ExtendsElem)[];

  /** name of the module. A synthetic name will be assigned if none is provided */
  name: string;
  
  fileName?: string;

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

export function parseModule(
  src: string,
  params: Record<string, any> = {},
  defaultModuleName?: string
): TextModule {
  const { text: preppedSrc, srcMap } = processConditionals(src, params);
  const parsed = parseWgslD(preppedSrc, srcMap);
  const exports = findExports(parsed, srcMap);
  const fns = filterElems<FnElem>(parsed, "fn");
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
    ...{ kind, src, srcMap, preppedSrc, name },
    ...{ exports, fns, structs, vars, imports, template },
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
