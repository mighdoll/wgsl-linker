import { E } from "vitest/dist/types-dea83b3d.js";
import { Lexer, matchingLexer } from "./MatchingLexer.js";
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
  parsing,
  repeat,
  seq,
  tokens,
} from "./ParserCombinator.js";

interface ParserState {
  lexer: Lexer;
  results: AbstractElem[];
}

export type AbstractElem = ExportElem;

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
    seq(opt(kind(a.word).named("exportName")), opt(directiveArgs.named("args")))
  )
).mapResults((r) => {
  const { start, end, results } = r;
  const { exportName, args } = r.named;
  const name = exportName?.[0];
  const e: ExportElem = { kind: "export", name, args, start, end };
  results.push(e);
});

export const directive = exportDirective; // TODO import directive

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
