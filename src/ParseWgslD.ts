import {
  AbstractElem,
  CallElem,
  FnElem,
  StructElem,
  StructMemberElem,
  TypeRefElem,
} from "./AbstractElems.js";
import { resultErr } from "./LinkerUtil.js";
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
import {
  comment,
  makeElem,
  unknown,
  word,
  wordNum,
  wordNumArgs,
} from "./ParseSupport.js";
import { word as wordRegex } from "./MatchWgslD.js";

/** parser that recognizes key parts of WGSL and also directives like #import */

// prettier gets confused if we leave the quoted parens inline so make consts for them here
const lParen = "(";
const rParen = ")";

export interface ParseState {
  ifStack: boolean[]; // stack used while processiing nested #if #else #endif directives
  params: Record<string, any>; // user provided params to templates, code gen and #if directives
}

const globalDirectiveOrAssert = seq(
  or("diagnostic", "enable", "requires", "const_assert"),
  req(anyThrough(";"))
).traceName("globalDirectiveOrAssert");

const attributes = repeat(seq(kind(mainTokens.attr), opt(wordNumArgs)));

export const structMember = seq(
  opt(attributes),
  word.named("name"),
  ":",
  req(word.named("memberType")) // TODO use typeSpecifier here
)
  .map((r) => {
    const e = makeElem<StructMemberElem>("member", r, ["name", "memberType"]);
    return e;
  })
  .traceName("structMember");

export const structDecl = seq(
  "struct",
  word.named("name"),
  "{",
  withSep(",", structMember).named("members"),
  opt(","),
  "}"
)
  .map((r) => {
    const e = makeElem<StructElem>("struct", r, ["name", "members"]);
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

const possibleTypeRef = Symbol("typeRef");

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
      // resultErr(r, "typeSpecifier", name);
      return e;
    })
  )
  .traceName("typeSpecifier");

// prettier-ignore
const fnParam = seq(
  word, 
  opt(seq(":", req(typeSpecifier.named("typeRefs"))))
);

const fnParamList = seq(
  lParen,
  opt(attributes),
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
  attributes,
  "fn",
  req(word.named("name")),
  req(fnParamList),
  opt(seq("->", opt(attributes), word.named("returnType"))),
  req(block)
)
  .traceName("fnDecl")
  .map((r) => {
    const fn = makeElem<FnElem>("fn", r, ["name", "returnType", "typeRefs"]);
    fn.children = r.named.calls || [];
    r.app.state.push(fn);
  });

export const globalValVarOrAlias = seq(
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
