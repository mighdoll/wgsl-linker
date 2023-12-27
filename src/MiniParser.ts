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
  position: number;
}

export interface ExportElem extends AbstractElemBase {
  kind: "export";
  name?: string;
  args?: string[];
}

const m = mainMatch;
const a = directiveArgsMatch;

const directiveArgs = seq(
  "lparen",
  kind(a.word).named("word"),
  repeat(seq(a.comma, kind(a.word).named("word"))),
  "rparen"
).mapResults((r) => r.named.word);

const exportDirective = seq(
  m.exportD,
  tokens(
    directiveArgsMatch,
    seq(opt(kind("word").named("exportName")), opt(directiveArgs.named("args")))
  )
).mapResults((r, state) => {
  const { exportName, args } = r.named;
  state.results.push({ kind: "export", name: exportName?.[0], args });
});

export const directive = exportDirective; // TODO import directive

export const lineComment = parsing((state: ParserState): boolean | null => {
  return state.lexer.withMatcher(lineCommentMatch, () => {
    const afterComment = or(directive, kind("notDirective"));
    const parser = seq(kind("lineComment"), afterComment);
    return parser(state) === null ? null : true;
  });
});

const root = or(directive, lineComment);

export function miniParse(src: string): AbstractElem[] {
  const lexer = matchingLexer(src, mainMatch);
  const results: AbstractElem[] = [];

  const state: ParserContext = { lexer, results };
  root(state);

  return state.results;
}

// export const lineComment = parsing(
//   (state: ParserState): OptParserResult<any> => {
//     return state.lexer.withMatcher(lineCommentMatch, () => {
//       const afterComment = or(directive, kind("notDirective"));
//       const parser = seq(kind("lineComment"), afterComment);
//       return parser(state);
//     });
//   }
// );
