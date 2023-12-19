import { Lexer } from "./MiniLexer.js";

export interface ParserContext {
  lexer: Lexer;
  results: any[];
}

export type ParserStage<T> = (state: ParserContext) => T;
export type ParserFn<T> = (state: ParserContext) => T;

export function parserStage<T>(fn: ParserFn<T>): ParserStage<T> {
  // add fluent interface methods?
  // reset position on failure?
  // return start position
  return fn;
}

export const kind = (kind: string) =>
  parserStage((state: ParserContext): string | null => {
    const next = state.lexer.next();
    return next?.kind === kind ? next.text : null;
  });

export function or<T, U>(
  a: ParserStage<T>,
  b: ParserStage<U>
): ParserStage<T | U> {
  return parserStage((state: ParserContext) => {
    const pos = state.lexer.position();
    const aResult = a(state);
    if (aResult) {
      return aResult;
    }
    state.lexer.setPosition(pos);
    return b(state);
  });
}

export function seq<T, U>(
  a: ParserStage<T | null>,
  b: ParserStage<U | null>
): ParserStage<[T, U] | null>;
export function seq<T, U, V>(
  a: ParserStage<T>,
  b: ParserStage<U>,
  c: ParserStage<V>
): ParserStage<[T, U, V] | null>;
export function seq(...stages: ParserStage<any>[]): ParserStage<any[] | null> {
  return parserStage((state: ParserContext) => {
    const results = [];
    for (const stage of stages) {
      const result = stage(state);
      if (result === null || result === undefined) {
        return null;
      }
      results.push(result);
    }
    return results;
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
