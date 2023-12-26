import { Lexer } from "./MatchingLexer.js";
import { Token } from "./TokenMatcher.js";

export interface ParserContext {
  lexer: Lexer;
  results: any[];
}

export interface ParserResult<T> {
  value: T;
  results: Record<string, any>;
}
export type OptParserResult<T> = ParserResult<T> | null;

export interface ParserStage<T> {
  (state: ParserContext): OptParserResult<T>;
  named(name: string): ParserStage<T>;
}

export type StageFn<T> = (state: ParserContext) => OptParserResult<T>;
export type ParserStageArg<T> = ParserStage<T> | string;

export function parsing<T>(
  fn: (state: ParserContext) => T | null | undefined
): ParserStage<T> {
  const parserFn: StageFn<T> = (state: ParserContext) => {
    const r = fn(state);
    if (r !== null && r !== undefined) {
      const result = { value: r, results: {} };
      return result;
    } else {
      return null;
    }
  };

  return parserStage(parserFn);
}

export function parserStage<T>(
  fn: StageFn<T>,
  resultName?: string
): ParserStage<T> {
  const stageFn = (state: ParserContext): OptParserResult<T> => {
    const position = state.lexer.position();
    const result = fn(state);
    if (result === null || result === undefined) {
      state.lexer.position(position);
      return null;
    }
    if (resultName) {
      const accumulated = {
        value: result.value,
        results: { ...result.results, [resultName]: [result] }, // TODO merge like named result arrays
      };
      return accumulated;
    } else {
      return result;
    }
  };
  stageFn.named = (name: string) => parserStage(fn, name);
  return stageFn;
}

export function kind(kind: string): ParserStage<Token> {
  return parserStage((state: ParserContext): ParserResult<Token> | null => {
    const next = state.lexer.next();
    if (next?.kind === kind) {
      return { value: next, results: {} };
    } else {
      return null;
    }
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
  return parserStage((state: ParserContext): ParserResult<any> | null => {
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
    const values = [];
    let namedResults = {};
    for (const stage of stages) {
      const parser = parserArg(stage);
      const result = parser(state);
      if (result === null) {
        return null;
      }
      namedResults = { ...namedResults, ...result.results }; // TODO merge like names
      values.push(result.value);
    }
    return { value: values, results: namedResults };
  });
}

export function opt<T>(stage: string): ParserStage<Token | boolean>;
export function opt<T>(stage: ParserStage<T>): ParserStage<T | boolean>;
export function opt<T>(
  stage: ParserStageArg<T>
): ParserStage<T | Token | boolean> {
  return parserStage(
    (state: ParserContext): OptParserResult<T | Token | boolean> => {
      const parser = parserArg(stage);
      const result = parser(state);
      return result || { value: false, results: {} };
    }
  );
}

export function repeat(stage: string): ParserStage<Token[]>;
export function repeat<T>(stage: ParserStage<T>): ParserStage<T[]>;
export function repeat<T>(
  stage: ParserStageArg<T>
): ParserStage<(T | Token)[]> {
  return parserStage((state: ParserContext): OptParserResult<(T | Token)[]> => {
    const values: (T | Token)[] = [];
    let results = {};
    while (true) {
      const parser = parserArg(stage);
      const result = parser(state);
      if (result !== null) {
        values.push(result.value);
        results = { ...results, ...result.results };
      } else {
        return { value: values, results };
      }
    }
  });
}

/** convert naked string arguments into kind() parsers */
function parserArg<T>(
  arg: ParserStageArg<T>
): ParserStage<T> | ParserStage<Token> {
  return typeof arg === "string" ? kind(arg) : arg;
}
