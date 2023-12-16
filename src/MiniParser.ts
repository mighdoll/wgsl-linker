import {
  Lexer,
  directiveArgsMatch,
  lex,
  lineCommentMatch,
} from "./MiniLexer.js";
import { Token } from "./TokenMatcher.js";

interface ParserState {
  lexer: Lexer;
  results: AbstractElem[];
}

export function miniParse(src: string): AbstractElem[] {
  const state: ParserState = {
    lexer: lex(src),
    results: [],
  };

  directive(state) || lineComment(state);
  return state.results;
}

/** 'interesting' elements found in the source */
interface AbstractElem extends Token {
  kind: string;
  position: number;
}

export function lineComment(state: ParserState): boolean {
  const { lexer } = state;
  if (lexer.peek()?.kind !== "lineComment") {
    return false;
  }
  lexer.pushMatcher(lineCommentMatch);
  lexer.next();
  directive(state) || lineComment(state);

  lexer.popMatcher();
  return true;
}

export function directive(state: ParserState): boolean {
  const { lexer } = state;
  if (lexer.peek()?.kind !== "directive") {
    return false;
  }
  lexer.next();
  directiveArgs(state);


  state.lexer.popMatcher();
  return true;
}

export function directiveArgs(state: ParserState): boolean {
  const { lexer } = state;
  lexer.pushMatcher(directiveArgsMatch);
  const next = lexer.next();
  return true;
}

// for (let token: Token | undefined; (token = lexer.next()); ) {
//   switch (token.kind) {
//     case "lineComment":

//     case "directive":
//     default:
//       console.log("unhandled token", token);
//   }
// }
