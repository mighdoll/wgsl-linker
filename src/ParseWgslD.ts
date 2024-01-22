import { AbstractElem, CallElem, FnElem, StructElem } from "./AbstractElems.js";
import { matchingLexer } from "./MatchingLexer.js";
import { mainTokens } from "./MatchWgslD.js";
import { directive, lineCommentOptDirective } from "./ParseDirective.js";
import { ExtendedResult, Parser, ParserInit } from "./Parser.js";
import {
  any,
  anyUntil,
  anyThrough,
  eof,
  fn,
  kind,
  not,
  opt,
  or,
  repeat,
  seq,
} from "./ParserCombinator.js";
import { comment, unknown, wordNumArgs } from "./ParseSupport.js";

/** parser that recognizes key parts of WGSL and also directives like #import */

export interface ParseState {
  ifStack: boolean[];
  params: Record<string, any>;
}

const globalDirectiveOrAssert = seq(
  or("diagnostic", "enable", "requires", "const_assert"),
  anyThrough(";")
).traceName("globalDirectiveOrAssert");

const structDecl = seq(
  "struct",
  kind(mainTokens.word),
  "{",
  repeat(or(lineCommentOptDirective, seq(not("}"), any()))),
  "}"
).map((r) => {
  const e = makeElem<StructElem>("struct", r, ["name"]);
  r.app.push(e);
});

export const fnCall = seq(
  kind(mainTokens.word)
    .named("call")
    .map((r) => makeElem<CallElem>("call", r, ["call"]))
    .named("calls"), // we collect this in fnDecl, to attach to FnElem
  "("
);

const attributes = repeat(seq(kind(mainTokens.attr), opt(wordNumArgs)));

const block: Parser<any> = seq(
  "{",
  repeat(
    or(
      lineCommentOptDirective,
      fnCall,
      fn(() => block),
      seq(not("}"), any())
    )
  ),
  "}"
).traceName("block");

export const fnDecl = seq(
  attributes,
  "fn",
  kind(mainTokens.word).named("name"),
  "(",
  repeat(anyUntil("{")),
  block
)
  .traceName("fnDecl")
  .map((r) => {
    const fn = makeElem<FnElem>("fn", r, ["name"]);
    fn.children = r.named.calls || [];
    r.app.push(fn);
  });

const globalValVarOrAlias = seq(
  attributes,
  or("const", "override", "var", "alias"),
  anyThrough(";")
);

const globalDecl = or(fnDecl, globalValVarOrAlias, ";", structDecl).traceName(
  "globalDecl"
);

const rootDecl = or(
  globalDirectiveOrAssert,
  globalDecl,
  directive,
  unknown
)
.traceName("rootDecl");

const root = seq(repeat(rootDecl), eof()).preParse(comment);

export function parseWgslD(
  src: string,
  params: Record<string, any> = {}
): AbstractElem[] {
  const lexer = matchingLexer(src, mainTokens);
  const app: AbstractElem[] = [];

  const appState: ParseState = { ifStack: [], params };
  const init: ParserInit = {
    lexer,
    app,
    appState: appState,
    maxParseCount: 1000,
  };

  root.parse(init);

  return init.app;
}

/** creat an AbstractElem by pulling fields from named parse results */
export function makeElem<U extends AbstractElem>(
  kind: U["kind"],
  er: ExtendedResult<any>,
  named: (keyof U)[],
  namedArrays: (keyof U)[] = []
): U {
  const { start, end } = er;
  const nv = mapIfDefined(named, er.named as NameRecord<U>, true);
  const av = mapIfDefined(namedArrays, er.named as NameRecord<U>);
  return { kind, start, end, ...nv, ...av } as U;
}

type NameRecord<A> = Record<keyof A, string[]>;

function mapIfDefined<A>(
  keys: (keyof A)[],
  array: Record<keyof A, string[]>,
  firstElem?: boolean
): Partial<Record<keyof A, string>> {
  const entries = keys.flatMap((k) => {
    const ak = array[k];
    const v = firstElem ? ak?.[0] : ak;

    if (v === undefined) return [];
    else return [[k, v]];
  });
  return Object.fromEntries(entries);
}
