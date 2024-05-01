import {
  anyNot,
  anyThrough,
  eof,
  fn,
  kind,
  matchingLexer,
  opt,
  or,
  Parser,
  ParserContext,
  ParserInit,
  preParse,
  repeat,
  req,
  seq,
  setTraceName,
  simpleParser,
  SrcMap,
  tracing,
  withSep,
} from "mini-parse";
import {
  AbstractElem,
  AliasElem,
  CallElem,
  FnElem,
  FnNameElem,
  GlobalDirectiveElem,
  StructElem,
  StructMemberElem,
  TypeNameElem,
  TypeRefElem,
  VarElem,
} from "./AbstractElems.js";
import { mainTokens } from "./MatchWgslD.js";
import { directive } from "./ParseDirective.js";
import {
  comment,
  makeElem,
  unknown,
  word,
  wordNumArgs,
} from "./ParseSupport.js";

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
).map((r) => {
  const e = makeElem<GlobalDirectiveElem>("globalDirective", r);
  r.app.state.push(e);
});

/** parse an identifier into a TypeNameElem */
export const typeNameDecl = req(word.named("name")).map((r) => {
  return makeElem<TypeNameElem>("typeName", r, ["name"]);
});

/** parse an identifier into a TypeNameElem */
export const fnNameDecl = req(word.named("name"), "missing fn name").map(
  (r) => {
    return makeElem<FnNameElem>("fnName", r, ["name"]);
  }
);

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
);

/** find possible references to user structs in this type specifier and any templates */
export const typeSpecifier: Parser<TypeRefElem[]> = seq(
  word.named(possibleTypeRef),
  opt(template)
).map((r) =>
  r.named[possibleTypeRef].map((name) => {
    const e = makeElem<TypeRefElem>("typeRef", r);
    e.name = name;
    return e;
  })
);

export const structMember = seq(
  optAttributes,
  word.named("name"),
  ":",
  req(typeSpecifier.named("typeRefs"))
).map((r) => {
  return makeElem<StructMemberElem>("member", r, ["name", "typeRefs"]);
});

export const structDecl = seq(
  "struct",
  req(typeNameDecl).named("nameElem"),
  req("{"),
  withSep(",", structMember).named("members"),
  req("}")
).map((r) => {
  const e = makeElem<StructElem>("struct", r, ["members"]);
  const nameElem = r.named.nameElem[0];
  e.nameElem = nameElem;
  e.name = nameElem.name;
  r.app.state.push(e);
});

// keywords that can be followed by (), not to be confused with fn calls
const callishKeyword = simpleParser("keyword", (ctx: ParserContext) => {
  const keywords = ["if", "for", "while", "const_assert", "return"];
  const token = ctx.lexer.next();
  const text = token?.text;
  if (text && keywords.includes(text)) {
    return text;
  }
});

export const fnCall = seq(
  word
    .named("name")
    .map((r) => makeElem<CallElem>("call", r, ["name"]))
    .named("calls"), // we collect this in fnDecl, to attach to FnElem
  "("
);

// prettier-ignore
const fnParam = seq(
  optAttributes,
  word,
  opt(seq(":", req(typeSpecifier.named("typeRefs"))))
);

const fnParamList = seq(lParen, withSep(",", fnParam), rParen);

// prettier-ignore
const variableDecl = seq(
  or("const", "var", "let", "override"), 
  word, 
  ":", 
  req(typeSpecifier).named("typeRefs")
);

const block: Parser<any> = seq(
  "{",
  repeat(
    or(
      callishKeyword,
      fnCall,
      fn(() => block),
      variableDecl,
      anyNot("}")
    )
  ),
  req("}")
);

export const fnDecl = seq(
  optAttributes,
  "fn",
  req(fnNameDecl).named("nameElem"),
  // TODO some built in functions can have a template here, e.g. bitcast
  req(fnParamList),
  opt(seq("->", optAttributes, typeSpecifier.named("typeRefs"))),
  req(block)
).map((r) => {
  const e = makeElem<FnElem>("fn", r);
  const nameElem = r.named.nameElem[0];
  e.nameElem = nameElem;
  e.name = nameElem.name;
  e.calls = r.named.calls || [];
  e.typeRefs = r.named.typeRefs?.flat() || [];
  r.app.state.push(e);
});

export const globalVar = seq(
  optAttributes,
  or("const", "override", "var"),
  opt(template),
  word.named("name"),
  opt(seq(":", req(typeSpecifier.named("typeRefs")))),
  req(anyThrough(";"))
).map((r) => {
  const e = makeElem<VarElem>("var", r, ["name"]);
  e.typeRefs = r.named.typeRefs?.flat() || [];
  r.app.state.push(e);
});

export const globalAlias = seq(
  "alias",
  req(word.named("name")),
  req("="),
  req(typeSpecifier).named("typeRefs"),
  req(";")
).map((r) => {
  const e = makeElem<AliasElem>("alias", r, ["name", "typeRefs"]);
  r.app.state.push(e);
});

const globalDecl = or(fnDecl, globalVar, globalAlias, structDecl, ";");

const rootDecl = or(globalDirectiveOrAssert, globalDecl, directive, unknown);

const root = preParse(comment, seq(repeat(rootDecl), eof()));

export function parseWgslD(
  src: string,
  srcMap?: SrcMap,
  params: Record<string, any> = {},
  maxParseCount: number | undefined = undefined,
  grammar = root
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
    srcMap,
    maxParseCount,
  };

  grammar.parse(init);

  return app.state;
}

if (tracing) {
  const names: Record<string, Parser<unknown>> = {
    globalDirectiveOrAssert,
    template,
    typeSpecifier,
    structMember,
    structDecl,
    fnCall,
    fnParam,
    fnParamList,
    block,
    fnDecl,
    globalVar,
    globalAlias,
    globalDecl,
    rootDecl,
    root,
  };

  Object.entries(names).forEach(([name, parser]) => {
    setTraceName(parser, name);
  });
}
