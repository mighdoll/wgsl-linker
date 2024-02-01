import { dlog } from "berry-pretty";
import {
  AbstractElem,
  ExportElem,
  FnElem,
  ImportElem,
  ImportMergeElem,
  StructElem,
  VarElem,
} from "./AbstractElems.js";
import { srcLog } from "./LinkerUtil.js";
import { parseWgslD } from "./ParseWgslD.js";

/** module with exportable text fragments that are optionally transformed by a templating engine */
export interface TextModule2 {
  template?: string;
  exports: TextExport2[];
  fns: FnElem[];
  vars: VarElem[];
  structs: StructElem[];
  imports: (ImportElem | ImportMergeElem)[];
  name: string;
  src: string;
}

export interface TextExport2 extends ExportElem {
  ref: FnElem | StructElem;
}

let unnamedModuleDex = 0;

export function parseModule2(
  src: string,
  defaultModuleName?: string
): TextModule2 {
  const parsed = parseWgslD(src);
  const exports = findExports(src, parsed);
  const fns = parsed.filter((e) => e.kind === "fn") as FnElem[];
  const imports = parsed.filter(
    (e) => e.kind === "import" || e.kind === "importMerge"
  ) as (ImportElem | ImportMergeElem)[];
  const structs = parsed.filter((e) => e.kind === "struct") as StructElem[];
  const vars = parsed.filter((e) => e.kind === "var") as VarElem[];
  const moduleName = undefined; // TODO parse #module
  matchMergeImports(src, parsed);

  const name = moduleName ?? defaultModuleName ?? `module${unnamedModuleDex++}`;
  return { name, exports, fns, structs, vars, imports, src };
}

function findExports(src: string, parsed: AbstractElem[]): TextExport2[] {
  const exports: TextExport2[] = [];
  parsed.forEach((elem, i) => {
    if (elem.kind === "export") {
      const next = parsed[i + 1];
      if (next?.kind === "fn") {
        exports.push({ ...elem, ref: next });
      } else if (next?.kind === "struct") {
        exports.push({ ...elem, ref: next });
      } else {
        srcLog(src, elem.start, `#export what? (#export not followed by fn)`);
      }
    }
  });
  return exports;
}

/** fill in importMerges field of structs */
function matchMergeImports(src: string, parsed: AbstractElem[]): void {
  const importMerges = parsed.flatMap((elem, i) =>
    elem.kind === "importMerge"
      ? ([[elem, i]] as [ImportMergeElem, number][])
      : []
  );
  importMerges.forEach(([mergeElem, i]) => {
    let next: AbstractElem | undefined;
    do {
      next = parsed[++i];
    } while (next?.kind === "importMerge");
    if (next?.kind === "struct") {
      next.importMerges = next.importMerges ?? [];
      next.importMerges.push(mergeElem);
    } else {
      srcLog(src, mergeElem.start, `#importMerge not followed by a struct`);
    }
  });

  for (let i = 0; i < parsed.length; i++) {
    const elem = parsed[i];
    if (elem.kind === "importMerge") {
    }
  }
}
