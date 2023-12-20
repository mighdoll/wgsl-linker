import { Lexer, matchingLexer } from "./MatchingLexer.js";
import { directiveArgsMatch, lineCommentMatch, mainMatch } from "./MiniLexer.js";
import { ParserContext, kind, parserStage, seq } from "./ParserCombinator.js";

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

const root = parserStage((state: ParserState) => directive(state));

export function miniParse(src: string): AbstractElem[] {
  const lexer = matchingLexer(src, mainMatch);
  const results: AbstractElem[] = [];

  const state: ParserContext = { lexer, results };
  root(state);

  return state.results;
}

const directive = parserStage((state: ParserState): string | null => {
  const directiveElems = seq(kind("directive"), singleWord)(state);
  if (directiveElems) {
    const [name, word] = directiveElems;
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
    return x?.[0] || null;
  });
});

// const lineComment = parserStage((state: ParserState): true | null => {
//   return state.lexer.withMatcher(lineCommentMatch, () => {
//     return seq(kind("lineComment"), directive)(state);
//   });
// });

// function lineComment(state: ParserState): boolean {
//   const { lexer } = state;
//   if (lexer.peek()?.kind !== "lineComment") {
//     return false;
//   }
//   lexer.pushMatcher(lineCommentMatch);
//   lexer.next();
//   directive(state) || lineComment(state);

//   lexer.popMatcher();
//   return true;
// }

// type ParseFn = (state: ParserState) => boolean;

// for (let token: Token | undefined; (token = lexer.next()); ) {
//   switch (token.kind) {
//     case "lineComment":

//     case "directive":
//     default:
//       console.log("unhandled token", token);
//   }
// }

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
