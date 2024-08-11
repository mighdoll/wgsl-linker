import {
  Parser,
  TagRecord,
  withTags,
  kind,
  opt,
  or,
  repeat,
  seq,
  setTraceName,
  text,
  tokens,
  tracing,
  withSep,
} from "mini-parse";
import {
  ImportTree,
  SegmentList,
  SimpleSegment,
  Wildcard,
} from "./ImportTree.js";
import { treeImportTokens } from "./MatchWgslD.js";
import { makeElem } from "./ParseSupport.js";
import { TreeImportElem } from "./AbstractElems.js";

const word = kind(treeImportTokens.word);

/*
 syntax supported:
    import a::b
    import self::b
    import super::super::b
    import self::{a, b::c}
    import self::{a, b::c}
    import self::{a, *}
    import a::{a as f, b::c as g}
    import a // [should this be allowed?

 TBD generic syntax:
    import a::b(X)
    import a::{a(X), b::c(X)}
 */

// forward reference (for mutual recursion)
let importTree: Parser<any, any> = null as any;

const simpleSegment = withTags(
  seq(word.tag("segment"), opt(seq("as", word.tag("as")))).map(
    (r) => new SimpleSegment(r.tags.segment[0], r.tags.as?.[0])
  )
);

const wildCard = text("*").map(() => Wildcard._);

const segmentList = withTags(
  seq("{", withSep(",", () => or(importTree, wildCard)).tag("list"), "}").map(
    (r) => {
      return new SegmentList(r.tags.list.flat());
    }
  )
);

const pathSegment = or(simpleSegment, wildCard, segmentList);

const pathExtension = withTags(
  repeat(seq("::", pathSegment.tag("segments"))).map((r) => {
    return r.tags.segments || [];
  })
);

importTree = seq(simpleSegment, pathExtension).map((r) => {
  return new ImportTree(r.value.flat());
});

/** parse a Rust style wgsl import statement.
 * The syntax is like 'use' in Rust.
 * 'self' references are not currently supported. */
export const rustImport = tokens(
  treeImportTokens,
  seq(
    or("#import", "import"), // bevy uses #import, but std says import
    importTree.tag("imports"),
    opt(";")
  ).map((r) => {
    const e = makeElem("treeImport", r, ["imports"]) as TreeImportElem;

    r.app.state.push(e);
  })
);

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
