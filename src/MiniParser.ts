import { Lexer, matchingLexer } from "./MatchingLexer.js";
import {
  directiveArgsMatch,
  lineCommentMatch,
  mainMatch,
} from "./MiniLexer.js";
import {
  ParserContext,
  kind,
  or,
  parserStage,
  seq,
} from "./ParserCombinator.js";

interface ParserState {
  lexer: Lexer;
  results: AbstractElem[];
}

export type AbstractElem = DirectiveElem;

/** 'interesting' elements found in the source */
export interface AbstractElemBase {
  kind: string;
  position: number;
}

export interface DirectiveElem extends AbstractElemBase {
  kind: "directive";
  name: string;
  args: string[];
}

type AnyFn = () => any;
type StringOrAnyFn = string | AnyFn;

const directive = parserStage((state: ParserState): string | null => {
  const directiveElems = seq(kind("directive"), singleWord)(state);
  if (directiveElems) {
    const [token, word] = directiveElems;
    const name = token.text;
    const position = state.lexer.position();
    state.results.push({ kind: "directive", name, args: [word], position });
    return name;
  } else {
    return null;
  }
});

const singleWord = parserStage((state: ParserState): string | null => {
  return state.lexer.withMatcher(directiveArgsMatch, () => {
    const x = seq(kind("word"), kind("eol"))(state);
    return x?.[0].text || null;
  });
});

export const lineComment = parserStage((state: ParserState): boolean => {
  return state.lexer.withMatcher(lineCommentMatch, () => {
    const afterComment = or(directive, kind("notDirective"));
    const parser = seq(kind("lineComment"), afterComment);
    return parser(state) != null;
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


// function parenArgs(): string[] | null {
//   return lexer.withMatcher(directiveArgsMatch, () => {
//     const results = seq("lparen", "word", "rparen", "eol");
//     if (!results) {
//       return null;
//     }
//     const args = [results[1]];
//     return args;
//   });
// }
