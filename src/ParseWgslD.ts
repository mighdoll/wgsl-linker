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

// prettier-ignore
const parenList = seq(
  lParen,
  withSep(",", anyNot(or(rParen, ","))),  // TODO merge with squareBracketList?
  rParen
)

// prettier-ignore
const squareBracketList:Parser<any> = seq(
  "[",
  withSep(",", 
    or(
      fn(() => squareBracketList), 
      repeat(anyNot(or("[", "]", ",")))  // TODO untested
    )
  ),
 "]" 
)

const templateParam = or(
  fn(() => typeSpecifier),
  // template params are arbitrary expressions which we don't want to fully parse
  // so we partially parse some expressions that have commas inside them 
  parenList, 
  squareBracketList,
  // and then skip the rest of the tokens until the next param or the template ends.

  repeat(anyNot(or(",", ">"))) // grammar allows any expression here, hopefully this skips those
)
  // .map((r) => resultErr(r, "templateParam"))
  .traceName("templateParam");

export const template: Parser<any> = seq(
  "<",
  withSep(",", templateParam),
  req(">")
)
  // .map((r) => {
  //   resultErr(r, "template");
  // })
  .traceName("template");

const conceptName = Symbol("conceptName");

const ident = or(word, wordNum);

/** return type references in this nested template */
export const typeSpecifier: Parser<TypeRefElem[]> = seq(
  ident.named(conceptName),
  opt(template)
)
  .map((r) =>
    r.named[conceptName].flatMap((name) => {
      if (wordRegex.test(name[0])) {
        const e = makeElem<TypeRefElem>("typeRef", r);
        e.name = name;
        // resultErr(r, "typeSpecifier", name);
        return [e];
      } else return [];
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
