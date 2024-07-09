import {
  Parser,
  TagRecord,
  clearTags,
  kind,
  opt,
  or,
  repeat,
  seq,
  setTraceName,
  text,
  tracing,
  withSep,
} from "mini-parse";
import { argsTokens } from "./MatchWgslD.js";
import { dlog, dlogOpt } from "berry-pretty";
import { AbstractElemBase } from "./AbstractElems.js";
import { makeElem } from "./ParseSupport.js";

type PathSegment = SimpleSegment | Wildcard | ImportTree | SegmentList;

export class ImportTree {
  constructor(public segments: PathSegment[]) {}
}

export interface TreeImportElem extends AbstractElemBase {
  kind: "treeImport";
  imports: ImportTree;
  from: string;
}

class SimpleSegment {
  constructor(
    public name: string,
    public as?: string
  ) {}
}

class SegmentList {
  constructor(public list: PathSegment[]) {}
}

class Wildcard {}

const argsWord = kind(argsTokens.arg);

// forward reference (for mutual recursion)
let importTree: Parser<any, any> = null as any;

const simpleSegment = clearTags(
  seq(argsWord.tag("segment"), opt(seq("as", argsWord.tag("as")))).map(
    (r) => new SimpleSegment(r.tags.segment[0], r.tags.as?.[0])
  )
);

const wildCard = text("*").map(() => Wildcard);

const segmentList = clearTags(
  seq("{", withSep(",", () => or(importTree, wildCard)).tag("list"), "}").map(
    (r) => {
      return new SegmentList(r.tags.list.flat());
    }
  )
);

const pathSegment = or(simpleSegment, wildCard, segmentList);

const pathExtension = clearTags(
  repeat(seq("::", pathSegment.tag("segments"))).map((r) => {
    return r.tags.segments || [];
  })
);

importTree = seq(simpleSegment, pathExtension).map((r) => {
  return new ImportTree(r.value.flat());
});

export const rustImport = seq(
  or("#import", "import"), // bevy uses #import, but std says import
  importTree.tag("imports"),
  opt(";")
).map((r) => {
  const e = makeElem("treeImport", r, ["imports", "from"]);

  r.app.state.push(e);
});

// enableTracing();
if (tracing) {
  const names: Record<string, Parser<unknown, TagRecord>> = {
    segmentList,
    simpleSegment,
    wildCard,
    pathSegment,
    pathExtension,
    importTree,
    rustImport,
  };

  Object.entries(names).forEach(([name, parser]) => {
    setTraceName(parser, name);
  });
}
