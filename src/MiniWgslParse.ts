import { matchingLexer } from "./MatchingLexer.js";
import {
  directiveArgsMatch,
  lineCommentMatch,
  mainMatch,
} from "./MiniWgslMatch.js";
import {
  ExtendedResult,
  ParserContext,
  ParserStage,
  any,
  fn,
  kind,
  not,
  opt,
  or,
  repeat,
  seq,
  text,
  tokens,
} from "./ParserCombinator.js";

export type AbstractElem = ImportElem | ExportElem | FnElem | CallElem;

/** 'interesting' elements found in the source */
export interface AbstractElemBase {
  kind: string;
  start: number;
  end: number;
}

export interface CallElem extends AbstractElemBase {
  kind: "call";
  call: string;
}

export interface FnElem extends AbstractElemBase {
  kind: "fn";
  fn: string;
  children: (ImportElem | CallElem)[];
}

export interface ExportElem extends AbstractElemBase {
  kind: "export";
  name?: string;
  args?: string[];
}

export interface ImportElem extends AbstractElemBase {
  kind: "import";
  name: string;
  args?: string[];
  as?: string;
  from?: string;
}

const m = mainMatch;
const a = directiveArgsMatch;
const l = lineCommentMatch;

const directiveArgs = seq(
  a.lparen,
  kind(a.word).named("word"),
  repeat(seq(a.comma, kind(a.word).named("word"))),
  a.rparen
).mapResults((r) => r.named.word);

const exportDirective = seq(
  m.exportD,
  tokens(
    directiveArgsMatch,
    seq(opt(kind(a.word).named("exp")), opt(directiveArgs.named("args")), a.eol)
  )
).mapResults((r) => {
  const { start, end, results } = r;
  const { exp, args } = r.named;
  const name = exp?.[0];
  const e: ExportElem = { kind: "export", name, args, start, end };
  results.push(e);
});

// #import foo<(a,b)> <from bar> <as boo>
const importDirective = seq(
  text("#import"),
  tokens(
    directiveArgsMatch,
    seq(
      kind(a.word).named("imp"),
      opt(directiveArgs.named("args")),
      opt(seq(text("from"), kind(a.word).named("from"))),
      opt(seq(a.as, kind(a.word).named("as"))),
      a.eol
    )
  )
).mapResults((r) => {
  const e = makeElem<ImportElem>("import", r, ["imp", "from", "as"], ["args"]);
  r.results.push(e);
});

export const directive = or(exportDirective, importDirective);

export const lineComment = seq(
  m.lineComment,
  tokens(lineCommentMatch, or(directive, l.notDirective))
);

export const fnCall = seq(
  kind(m.word)
    .mapResults(({ start, end, value }) => ({ start, end, call: value }))
    .named("call"),
  m.lparen
);

const block: ParserStage<any> = seq(
  m.lbrace,
  repeat(
    or(
      lineComment,
      fnCall,
      fn(() => block),
      not(m.rbrace)
    )
  ),
  m.rbrace
);

export const fnDecl = seq(
  text("fn"),
  kind(a.word).named("fn"),
  "lparen",
  repeat(or(lineComment, not(m.lbrace))),
  block
).mapResults((r) => {
  const calls = r.named.call || [];
  const callElems: CallElem[] = calls.map(({ start, end, call }) => {
    return { kind: "call", start, end, call };
  });
  const fn = makeElem<FnElem>("fn", r, ["fn"]);
  fn.children = callElems;
  r.results.push(fn);
});

const unknown = any().map((t) => console.log("unknown", t));
const rootDecl = or(fnDecl, directive, lineComment, unknown);

const root = repeat(rootDecl); // TODO check for EOF

export function parseMiniWgsl(src: string): AbstractElem[] {
  const lexer = matchingLexer(src, mainMatch);
  const app: AbstractElem[] = [];

  const state: ParserContext = { lexer, app };
  root(state);

  return state.app;
}

/** creat an AbstractElem by pulling fields from named parse results */
function makeElem<U extends AbstractElem>(
  kind: U["kind"],
  er: ExtendedResult<any>,
  named: string[],
  namedArrays: string[] = []
): U {
  const { start, end } = er;
  const nameValues = named.map((n) => [n, er.named[n]?.[0]]);
  const arrayValues = namedArrays.map((n) => [n, er.named[n]]);
  const nv = Object.fromEntries(nameValues);
  const av = Object.fromEntries(arrayValues);
  return { kind, start, end, ...nv, ...av };
}
