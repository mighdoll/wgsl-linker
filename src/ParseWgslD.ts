import {
  AbstractElem,
  CallElem,
  FnElem,
  StructElem,
  StructMemberElem,
  TypeRefElem,
  VarElem,
} from "./AbstractElems.js";
import { resultErr } from "./LinkerUtil.js";
import { mainTokens } from "./MatchWgslD.js";
import { matchingLexer } from "./MatchingLexer.js";
import { directive } from "./ParseDirective.js";
import {
  comment,
  makeElem,
  unknown,
  word,
  wordNumArgs,
} from "./ParseSupport.js";
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
  withSep,
} from "./ParserCombinator.js";

/** parser that recognizes key parts of WGSL and also directives like #import */

// prettier gets confused if we leave the quoted parens inline so make consts for them here
const lParen = "(";
const rParen = ")";

export interface ParseState {
  ifStack: boolean[]; // stack used while processiing nested #if #else #endif directives
  params: Record<string, any>; // user provided params to templates, code gen and #if directives
}

const optAttributes = repeat(seq(kind(mainTokens.attr), opt(wordNumArgs)));
const possibleTypeRef = Symbol("typeRef");

const globalDirectiveOrAssert = seq(
  or("diagnostic", "enable", "requires", "const_assert"),
  req(anyThrough(";"))
).traceName("globalDirectiveOrAssert");

/** find possible references to user types (structs) in this possibly nested template */
export const template: Parser<any> = seq(
  "<",
  or(
    word.named(possibleTypeRef), // only the first element of the template can be a type
    fn(() => template)
  ),
  repeat(
    or(
      fn(() => template),
      anyNot(">") // we don't care about the rest of the template
    )
  ),
  req(">")
).traceName("template");

/** find possible references to user structs in this type specifier and any templates */
export const typeSpecifier: Parser<TypeRefElem[]> = seq(
  word.named(possibleTypeRef),
  opt(template)
)
  .map((r) =>
    r.named[possibleTypeRef].map((name) => {
      const e = makeElem<TypeRefElem>("typeRef", r);
      e.name = name;
      return e;
    })
  )
  .traceName("typeSpecifier");

export const structMember = seq(
  optAttributes,
  word.named("name"),
  ":",
  req(typeSpecifier.named("typeRefs"))
)
  .map((r) => {
    const e = makeElem<StructMemberElem>("member", r, ["name"]);
    return e;
  })
  .traceName("structMember");

// prettier-ignore
export const structDecl = seq(
  "struct",
  req(word.named("name")),
  req("{"),
  withSep(",", structMember).named("members"),
  opt(","),
  req("}")
)
  .map((r) => {
    const e = makeElem<StructElem>("struct", r, ["name", "members"]);
    e.typeRefs = r.named.typeRefs?.flat() || []; 
    r.app.state.push(e);
  })
  .traceName("structDecl");

export const fnCall = seq(
  word
    .named("call")
    .map((r) => makeElem<CallElem>("call", r, ["call"]))
    .named("calls"), // we collect this in fnDecl, to attach to FnElem
  "("
).traceName("fnCall");

// prettier-ignore
const fnParam = seq(
  word, 
  opt(seq(":", req(typeSpecifier.named("typeRefs"))))
);

const fnParamList = seq(
  lParen,
  optAttributes,
  withSep(",", fnParam),
  rParen
).traceName("fnParamList");

// prettier-ignore
const variableDecl = seq(
  or("const", "var", "let", "override"), 
  word, 
  ":", 
  req(typeSpecifier).named("typeRefs")
).traceName("variableDecl");

const block: Parser<any> = seq(
  "{",
  repeat(
    or(
      fnCall,
      fn(() => block),
      variableDecl,
      anyNot("}")
    )
  ),
  req("}")
).traceName("block");

export const fnDecl = seq(
  optAttributes,
  "fn",
  req(word.named("name")),
  req(fnParamList),
  opt(seq("->", optAttributes, word.named("returnType"))),
  req(block)
)
  .map((r) => {
    const e = makeElem<FnElem>("fn", r, ["name", "returnType"]);
    e.children = r.named.calls || [];
    e.typeRefs = r.named.typeRefs?.flat() || [];
    r.app.state.push(e);
  })
  .traceName("fnDecl");

export const globalVar = seq(
  optAttributes,
  or("const", "override", "var"),
  opt(template),
  word.named("name"),
  opt(seq(":", req(typeSpecifier.named("typeRefs")))),
  req(anyThrough(";"))
).map(r => {
  // resultErr(r, "globalVar");
  const e = makeElem<VarElem>("var", r, ["name", "typeRefs"]);
  r.app.state.push(e);
}).traceName("globalVar");

export const globalAlias = seq("alias", req(anyThrough(";")));

const globalDecl = or(
  fnDecl,
  globalVar,
  globalAlias,
  structDecl,
  ";"
).traceName("globalDecl");

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
