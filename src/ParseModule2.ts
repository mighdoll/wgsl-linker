import {
  AbstractElem,
  FnElem,
  ImportElem,
  parseMiniWgsl,
} from "./MiniWgslParse.js";

/** module with exportable text fragments that are optionally transformed by a templating engine */
export interface TextModule2 {
  template?: string;
  exports: TextExport2[];
  fns: FnElem[];
  imports: ImportElem[];
}

export interface TextExport2 {
  ref: FnElem; // TODO | StructElem (| global var?)
  // TODO parse report export params
}

export function parseModule2(src: string): TextModule2 {
  const parsed = parseMiniWgsl(src);
  const exports = findExports(parsed);
  const fns = parsed.filter((e) => e.kind === "fn") as FnElem[];
  const imports = parsed.filter((e) => e.kind === "import") as ImportElem[];
  return { exports, fns, imports };
}

// TODO consider how to export fields inside a struct.. currently indicated #export foo
// should we still do text capture for fields? seems better to export (and merge?) the struct itself..

function findExports(parsed: AbstractElem[]): TextExport2[] {
  const exports: TextExport2[] = [];
  parsed.forEach((elem, i) => {
    if (elem.kind === "export") {
      const next = parsed[i + 1];
      if (next?.kind === "fn") {
        exports.push({ ref: next });
      }
    }
  });
  return exports;
}
