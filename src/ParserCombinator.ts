import { Lexer } from "./MatchingLexer.js";
import { Token } from "./TokenMatcher.js";

export interface ParserContext {
  lexer: Lexer;
  results: any[];
}

export type ParserStage<T> = (state: ParserContext) => T | null;
export type ParserFn<T> = (state: ParserContext) => T | null;

export function parserStage<T>(fn: ParserFn<T>): ParserStage<T> {
  return (state: ParserContext): T | null => {
    const position = state.lexer.position();
    const result = fn(state);
    if (result === null || result === undefined) {
      state.lexer.setPosition(position);
      return null;
    } else {
      return result;
    }
  };

  // add fluent interface methods?
  // return start position?
}

export function kind(kind: string): ParserStage<Token> {
  return parserStage((state: ParserContext): Token | null => {
    const next = state.lexer.next();
    return next?.kind === kind ? next : null;
  });
}

export function or<T, U>(
  a: ParserStage<T>,
  b: ParserStage<U>
): ParserStage<T | U>;
export function or<T, U, V>(
  a: ParserStage<T>,
  b: ParserStage<U>,
  c: ParserStage<V>
): ParserStage<T | U | V>;
export function or(...stages: ParserStage<any>[]): ParserStage<any> {
  return parserStage((state: ParserContext) => {
    for (const p of stages) {
      const result = p(state);
      if (result !== null) {
        return result;
      }
    }
    return null;
  });
}

export function seq<T, U>(
  a: ParserStage<T>,
  b: ParserStage<U>
): ParserStage<[T, U]>;
export function seq<T, U, V>(
  a: ParserStage<T>,
  b: ParserStage<U>,
  c: ParserStage<V>
): ParserStage<[T, U, V]>;
export function seq(...stages: ParserStage<any>[]): ParserStage<any[]> {
  return parserStage((state: ParserContext) => {
    const results = [];
    for (const stage of stages) {
      const result = stage(state);
      if (result === null) {
        return null;
      }
      results.push(result);
    }
    return results;
  });
}

export function opt<T>(stage: ParserStage<T>): ParserStage<T | boolean> {
  return parserStage((state: ParserContext) => {
    return stage(state) || false;
  });
}

export function repeat<T>(stage: ParserStage<T>): ParserStage<T[]> {
  return parserStage((state: ParserContext) => {
    const results = [];
    while (true) {
      const result = stage(state);
      if (result === null) {
        return results;
      }
      results.push(result);
    }
  });
}

/*
  
   // syntax 1. wrapper functions for or, seq, opt, rep
  const root = or(lineComment, fnDecl);
  const lineComment = seq(kind("lineComment", opt(directive)));
  const results = parse(root, lexer)

  // syntax 2. fluent interface 
  const root = lineComment.or(fnDecl);
  const lineComment = kind("lineComment").opt(directive);

  in either case, each stage needs to take in a ParserContext.
  Output could be a struct, or maybe just a non-undefined value.

  TS type for the result value for some of these combinators is tricky, 
  something like a seq returns an array of multiple types..
  
*/

function parserChain(src: string) {}
