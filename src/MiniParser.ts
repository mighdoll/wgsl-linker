import { matchingLexer } from "./MatchingLexer.js";
import {
  directiveArgsMatch,
  lineCommentMatch,
  mainMatch,
} from "./MiniLexer.js";
import {
  ParserContext,
  kind,
  opt,
  or,
  repeat,
  seq,
  tokens,
} from "./ParserCombinator.js";

export type AbstractElem = ImportElem | ExportElem;

/** 'interesting' elements found in the source */
export interface AbstractElemBase {
  kind: string;
  start: number;
  end: number;
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
  m.importD,
  tokens(
    directiveArgsMatch,
    seq(
      kind(a.word).named("imp"),
      opt(directiveArgs.named("args")),
      opt(seq(a.from, kind(a.word).named("from"))),
      opt(seq(a.as, kind(a.word).named("as")))
    )
  )
).mapResults((r) => {
  const { start, end, results } = r;
  const { imp, args, from, as } = r.named;
  const name = imp[0];
  const f = from?.[0];
  const a = as?.[0];
  const kind = "import";
  const e: ImportElem = { kind, name, args, from: f, as: a, start, end };
  results.push(e);
});

export const directive = or(exportDirective, importDirective);

export const lineComment = tokens(
  lineCommentMatch,
  or(directive, l.notDirective)
);

const root = or(directive, lineComment);

export function miniParse(src: string): AbstractElem[] {
  const lexer = matchingLexer(src, mainMatch);
  const app: AbstractElem[] = [];

  const state: ParserContext = { lexer, app };
  root(state);

  return state.app;
}
