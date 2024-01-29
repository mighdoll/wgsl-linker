import { AbstractElem, CallElem, FnElem, StructElem } from "./AbstractElems.js";
import { matchingLexer } from "./MatchingLexer.js";
import { mainTokens } from "./MatchWgslD.js";
import { directive } from "./ParseDirective.js";
import { Parser, ParserInit } from "./Parser.js";
import {
  anyNot,
  anyThrough,
  eof,
  fn,
  kind,
  opt,
  or,
  repeat,
  req,
  seq,
  text,
  withSep,
} from "./ParserCombinator.js";
import { comment, makeElem, unknown, wordNumArgs } from "./ParseSupport.js";

/** parser that recognizes key parts of WGSL and also directives like #import */

export interface ParseState {
  ifStack: boolean[]; // stack used while processiing nested #if #else #endif directives
  params: Record<string, any>; // user provided params to templates, code gen and #if directives
}

const globalDirectiveOrAssert = seq(
  or("diagnostic", "enable", "requires", "const_assert"),
  req(anyThrough(";"))
).traceName("globalDirectiveOrAssert");

const structDecl = seq(
  "struct",
  kind(mainTokens.word),
  "{",
  req(anyThrough("}"))
).map((r) => {
  const e = makeElem<StructElem>("struct", r, ["name"]);
  r.app.state.push(e);
});

export const fnCall = seq(
  kind(mainTokens.word)
    .named("call")
    .map((r) => makeElem<CallElem>("call", r, ["call"]))
    .named("calls"), // we collect this in fnDecl, to attach to FnElem
  "("
).traceName("fnCall");

const attributes = repeat(seq(kind(mainTokens.attr), opt(wordNumArgs)));

const lParen = "(";
const rParen = ")";

const param = seq(
  kind(mainTokens.word),
  opt(seq(":", req(kind(mainTokens.word).named("argTypes"))))
);

const paramList = seq(
  lParen,
  opt(attributes),
  withSep(",", param),
  rParen
).traceName("paramList");

const block: Parser<any> = seq(
  "{",
  repeat(
    or(
      fnCall,
      fn(() => block),
      anyNot("}")
    )
  ),
  req("}")
).traceName("block");

export const fnDecl = seq(
  attributes,
  "fn",
  req(kind(mainTokens.word).named("name")),
  req(paramList),
  opt(seq("->", opt(attributes), kind(mainTokens.word).named("returnType"))),
  req(block)
)
  .traceName("fnDecl")
  .map((r) => {
    const fn = makeElem<FnElem>("fn", r, ["name", "returnType"], ["argTypes"]);
    fn.children = r.named.calls || [];
    r.app.state.push(fn);
  });

const globalValVarOrAlias = seq(
  attributes,
  or("const", "override", "var", "alias"),
  req(anyThrough(";"))
);

const globalDecl = or(fnDecl, globalValVarOrAlias, ";", structDecl).traceName(
  "globalDecl"
);

const rootDecl = or(
  globalDirectiveOrAssert,
  globalDecl,
  directive,
  unknown
).traceName("rootDecl");

const root = seq(repeat(rootDecl), eof()).preParse(comment);

export function parseWgslD(
  src: string,
  params: Record<string, any> = {}
): AbstractElem[] {
  const lexer = matchingLexer(src, mainTokens);
  const state: AbstractElem[] = [];
  const context: ParseState = { ifStack: [], params };
  const app = {
    context,
    state,
  };
  const init: ParserInit = {
    lexer,
    app,
    maxParseCount: 1000,
  };

  root.parse(init);

  return init.app.state;
}
