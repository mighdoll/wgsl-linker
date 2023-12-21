import { Lexer } from "./MatchingLexer.js";
import { Token } from "./TokenMatcher.js";

export interface ParserContext {
  lexer: Lexer;
  results: any[];
}

export type ParserStage<T> = (state: ParserContext) => T | null;
export type ParserFn<T> = (state: ParserContext) => T | null | undefined;
export type ParserStageArg<T> = ParserStage<T> | string;

export function parserStage<T>(fn: ParserFn<T>): ParserStage<T> {
  return (state: ParserContext): T | null => {
    const position = state.lexer.position();
    const result = fn(state);
    if (result === null || result === undefined) {
      state.lexer.position(position);
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

export function or<T = Token, U = Token>(
  a: ParserStageArg<T>,
  b: ParserStageArg<U>
): ParserStage<T | U>;
export function or<T = Token, U = Token, V = Token>(
  a: ParserStageArg<T>,
  b: ParserStageArg<U>,
  c: ParserStageArg<V>
): ParserStage<T | U | V>;
export function or(...stages: ParserStageArg<any>[]): ParserStage<any> {
  return parserStage((state: ParserContext) => {
    for (const stage of stages) {
      const parser = parserArg(stage);
      const result = parser(state);
      if (result !== null) {
        return result;
      }
    }
    return null;
  });
}

export function seq<T = Token, U = Token>(
  a: ParserStageArg<T>,
  b: ParserStageArg<U>
): ParserStage<[T, U]>;
export function seq<T = Token, U = Token, V = Token>(
  a: ParserStageArg<T>,
  b: ParserStageArg<U>,
  c: ParserStageArg<V>
): ParserStage<[T, U, V]>;
export function seq(...stages: ParserStageArg<any>[]): ParserStage<any[]> {
  return parserStage((state: ParserContext) => {
    const results = [];
    for (const stage of stages) {
      const parser = parserArg(stage);
      const result = parser(state);
      if (result === null) {
        return null;
      }
      results.push(result);
    }
    return results;
  });
}

export function opt<T>(stage: string): ParserStage<Token | boolean>;
export function opt<T>(stage: ParserStage<T>): ParserStage<T | boolean>;
export function opt<T>(
  stage: ParserStageArg<T>
): ParserStage<T | Token | boolean> {
  return parserStage((state: ParserContext) => {
    const parser = parserArg(stage);
    const result = parser(state);
    return result || false;
  });
}

export function repeat(stage: string): ParserStage<Token[]>;
export function repeat<T>(stage: ParserStage<T>): ParserStage<T[]>;
export function repeat<T>(
  stage: ParserStageArg<T>
): ParserStage<(T | Token)[]> {
  return parserStage((state: ParserContext) => {
    const results = [];
    while (true) {
      const parser = parserArg(stage);
      const result = parser(state);
      if (result === null) {
        return results;
      }
      results.push(result);
    }
  });
}

/** convert naked string arguments into kind() parsers */
function parserArg<T>(
  arg: ParserStageArg<T>
): ParserStage<T> | ParserStage<Token> {
  return typeof arg === "string" ? kind(arg) : arg;
}
