import {
  AbstractElem,
  CallElem,
  ExportElem,
  FnElem,
  ImportElem,
  StructElem,
} from "./AbstractElems.js";
import { matchingLexer } from "./MatchingLexer.js";
import {
  directiveArgsTokens,
  lineCommentTokens,
  mainTokens,
} from "./MatchWgslD.js";
import { directive, lineComment, } from "./ParseDirective.js";
import {
  any,
  eof,
  ExtendedResult,
  fn,
  kind,
  not,
  opt,
  or,
  ParserContext,
  ParserStage,
  repeat,
  seq,
  tokens,
} from "./ParserCombinator.js";
import {
  anyUntil,
  eol,
  seqWithComments,
  unknown,
  wordArgs,
  wordNumArgs
} from "./ParseSupport.js";

/** parser that recognizes key parts of WGSL and also directives like #import */

export interface ParseState {
  ifStack: boolean[];
  params: Record<string, any>;
}

const m = mainTokens;
const a = directiveArgsTokens;

const globalDirectiveOrAssert = seqWithComments(
  or("diagnostic", "enable", "requires", "const_assert"),
  anyUntil(";")
);

const structDecl = seq(
  "struct",
  kind(m.word),
  "{",
  repeat(or(lineComment, seq(not("}"), any()))),
  "}"
).map((r) => {
  const e = makeElem<StructElem>("struct", r, ["name"]);
  r.app.push(e);
});

export const fnCall = seq(
  kind(m.word)
    .named("call")
    .map((r) => makeElem<CallElem>("call", r, ["call"]))
    .named("calls"), // we collect this in fnDecl, to attach to FnElem
  "("
);

const attributes = repeat(seq(kind(m.attr), opt(wordNumArgs)));

const block: ParserStage<any> = seq(
  "{",
  repeat(
    or(
      lineComment,
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
  kind(a.word).named("name"),
  "(",
  repeat(or(lineComment, seq(not("{"), any()))),
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
  anyUntil(";")
);

const globalDecl = or(fnDecl, globalValVarOrAlias, ";", structDecl);

const rootDecl = or(
  globalDirectiveOrAssert,
  globalDecl,
  lineComment,
  directive,
  unknown
);

const root = seq(repeat(rootDecl), eof());

export function parseWgslD(
  src: string,
  params: Record<string, any> = {}
): AbstractElem[] {
  const lexer = matchingLexer(src, mainTokens);
  const app: AbstractElem[] = [];

  const appState: ParseState = { ifStack: [], params };
  const context: ParserContext = { lexer, app, appState: appState };

  root(context);

  return context.app;
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
