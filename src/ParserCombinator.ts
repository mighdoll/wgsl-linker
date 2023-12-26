import { Lexer } from "./MatchingLexer.js";
import { Token } from "./TokenMatcher.js";

export interface ParserContext {
  lexer: Lexer;
  results: any[];
}

export interface ParserResult<T> {
  value: T;
  results: Record<string, any[]>;
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
        results: mergeNamed(result.results, { [resultName]: [result.value] }),
      };
      return accumulated;
    } else {
      return result;
    }
  };
  stageFn.named = (name: string) => parserStage(fn, name);
  return stageFn;
}

export function kind(kind: string): ParserStage<string> {
  return parsing((state: ParserContext): string | null => {
    const next = state.lexer.next();
    return next?.kind === kind ? next.text : null;
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
      namedResults = mergeNamed(namedResults, result.results);
      values.push(result.value);
    }
    return { value: values, results: namedResults };
  });
}

export function opt<T>(stage: string): ParserStage<string | boolean>;
export function opt<T>(stage: ParserStage<T>): ParserStage<T | boolean>;
export function opt<T>(
  stage: ParserStageArg<T>
): ParserStage<T | string | boolean> {
  return parserStage(
    (state: ParserContext): OptParserResult<T | string | boolean> => {
      const parser = parserArg(stage);
      const result = parser(state);
      return result || { value: false, results: {} };
    }
  );
}

export function repeat(stage: string): ParserStage<string[]>;
export function repeat<T>(stage: ParserStage<T>): ParserStage<T[]>;
export function repeat<T>(
  stage: ParserStageArg<T>
): ParserStage<(T | string)[]> {
  return parserStage(
    (state: ParserContext): OptParserResult<(T | string)[]> => {
      const values: (T | string)[] = [];
      let results = {};
      while (true) {
        const parser = parserArg(stage);
        const result = parser(state);
        if (result !== null) {
          values.push(result.value);
          results = mergeNamed(results, result.results);
        } else {
          return { value: values, results };
        }
      }
    }
  );
}

/** convert naked string arguments into kind() parsers */
function parserArg<T>(
  arg: ParserStageArg<T>
): ParserStage<T> | ParserStage<string> {
  return typeof arg === "string" ? kind(arg) : arg;
}

/** merge arrays in liked named keys */
function mergeNamed(
  a: Record<string, any[]>,
  b: Record<string, any[]>
): Record<string, any[]> {
  const sharedKeys = Object.keys(a).filter((k) => b[k]);
  // combine arrays from liked named keys
  const sharedEntries = sharedKeys.map((k) => [k, [...a[k], ...b[k]]]); 
  const shared = Object.fromEntries(sharedEntries);
  return { ...a, ...b, ...shared }; // shared keys overwritten
}
