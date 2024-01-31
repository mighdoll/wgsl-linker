import { dlog } from "berry-pretty";
import {
  AbstractElem,
  ExportElem,
  FnElem,
  ImportElem,
  StructElem,
} from "./AbstractElems.js";
import { srcErr } from "./LinkerUtil.js";
import { parseWgslD } from "./ParseWgslD.js";

/** module with exportable text fragments that are optionally transformed by a templating engine */
export interface TextModule2 {
  template?: string;
  exports: TextExport2[];
  fns: FnElem[];
  structs: StructElem[];
  imports: ImportElem[];
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
  const imports = parsed.filter((e) => e.kind === "import") as ImportElem[];
  const structs = parsed.filter((e) => e.kind === "struct") as StructElem[];
  const moduleName = undefined; // TODO parse #module

  const name = moduleName ?? defaultModuleName ?? `module${unnamedModuleDex++}`;
  return { name, exports, fns, structs, imports, src };
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
        srcErr(src, elem.start, `#export what? (#export not followed by fn)`);
      }
    }
  });
  return exports;
}
