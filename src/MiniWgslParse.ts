import { matchingLexer } from "./MatchingLexer.js";
import {
  directiveArgsMatch,
  lineCommentMatch,
  mainMatch,
} from "./MiniWgslMatch.js";
import {
  ExtendedResult,
  ParserContext,
  kind,
  opt,
  or,
  repeat,
  seq,
  text,
  tokens,
} from "./ParserCombinator.js";

export type AbstractElem = ImportElem | ExportElem | FnElem;

/** 'interesting' elements found in the source */
export interface AbstractElemBase {
  kind: string;
  start: number;
  end: number;
}

export interface FnElem extends AbstractElemBase {
  kind: "fn";
  fn?: string;
}

export interface ExportElem extends AbstractElemBase {
  kind: "export";
  name?: string;
  args?: string[];
}

export interface ImportElem extends AbstractElemBase {
  kind: "import";
  name?: string;
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
    seq(opt(kind(a.word).named("exp")), opt(directiveArgs.named("args")))
  )
).mapResults((r) => {
  const { start, end, results } = r;
  const { exp, args } = r.named;
  const name = exp?.[0];
  const e: ExportElem = { kind: "export", name, args, start, end };
  results.push(e);
});

const importDirective = seq(
  text("#import"),
  tokens(
    directiveArgsMatch,
    seq(
      kind(a.word).named("imp"),
      opt(directiveArgs.named("args")),
      opt(seq(text("from"), kind(a.word).named("from"))),
      opt(seq(a.as, kind(a.word).named("as")))
    )
  )
).mapResults((r) => {
  const e = makeElem<ImportElem>("import", r, ["imp", "from", "as"], ["args"]);
  r.results.push(e);
});

export const fnDecl = seq(
  text("fn"),
  kind(a.word).named("fn"),
  "lparen"
).mapResults((r) => {
  r.results.push(makeElem<FnElem>("fn", r, ["fn"]));
});

export const directive = or(exportDirective, importDirective);

export const lineComment = tokens(
  lineCommentMatch,
  or(directive, l.notDirective)
);

const root = or(fnDecl, directive, lineComment);

export function miniParse(src: string): AbstractElem[] {
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
