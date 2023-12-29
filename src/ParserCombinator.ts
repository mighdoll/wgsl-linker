import { Lexer } from "./MatchingLexer.js";
import { Token, TokenMatcher } from "./TokenMatcher.js";

/** Parsing Combinators
 *
 * The basic idea is that parsers are contructed heirarchically from other parsers.
 * Each parser is independently testable and reusable with combinators like or() and seq().
 *
 * Each parser is a function that recognizes tokens produced by a lexer
 * and returns a result.
 *  Returning null indicate failure. Tokens are not consumed on failure.
 *  Users can also use the .named() method to tag results from a stage. Named results
 *    propagate up to containing parsers for convenience in selecting results.
 *
 * Built in parsers and combinators are available:
 *  kind() recognizes tokens of a particular type.
 *  or(), seq(), opt(), map(), and repeat() combine other stages.
 *
 * Users construct their own parsers by combining other parser stages
 * and typically use mapResults() to report results. Results can be stored
 * in the array app[], which is provided by the user and available for
 * all user constructed parsers.
 */

/** Information passed to the parsers during parsing */
export interface ParserContext {
  /** supply tokens to the parser*/
  lexer: Lexer;

  /** handy place for user written parsers to accumulate application results */
  app: any[];
}

/** Result from a parser */
export interface ParserResult<T> {
  /** result from this stage */
  value: T;

  /** named results from this stage and all child stages*/
  named: Record<string, any[]>;
}

export interface ExtendedResult<T> extends ParserResult<T> {
  start: number;
  end: number;
  results: any[];
}

/** parsers return null if they don't match */
export type OptParserResult<T> = ParserResult<T> | null;

/** a composable parsing element */
export interface ParserStage<T> {
  (state: ParserContext): OptParserResult<T>;
  named(name: string): ParserStage<T>;
  map<U>(fn: (result: T) => U | null): ParserStage<U | true>;
  mapResults<U>(
    fn: (result: ExtendedResult<T>) => U | null
  ): ParserStage<U | true>;
  parserName?: string;
  debug(name: string): ParserStage<T>;
}

/** Internal parsing functions return a value and also a set of named results from contained parser  */
type StageFn<T> = (state: ParserContext) => OptParserResult<T>;

/** parser combinators like or() and seq() combine other stages (strings are converted to kind() parsers) */
type ParserStageArg<T> = ParserStage<T> | string;

// TODO consider dropping this
/** Create a ParserStage from a function that parses and returns a value */
export function parsing<T>(
  fn: (state: ParserContext) => T | null | undefined
): ParserStage<T> {
  const parserFn: StageFn<T> = (state: ParserContext) => {
    const r = fn(state);
    if (r !== null && r !== undefined) {
      return { value: r, named: {} };
    } else {
      return null;
    }
  };

  return parserStage(parserFn);
}

/** Create a ParserStage from a full StageFn function that returns an OptParserResult */
export function parserStage<T>(
  fn: StageFn<T>,
  resultName?: string
): ParserStage<T> {
  let debug: string;

  const stageFn = (state: ParserContext): OptParserResult<T> => {
    const position = state.lexer.position();
    const result = fn(state);
    if (result === null || result === undefined) {
      if (debug) console.log(`${debug} no match`);
      state.lexer.position(position);
      return null;
    } else {
      if (debug) console.log(`${debug} matched`);
      if (resultName) {
        return {
          value: result.value,
          named: mergeNamed(result.named, { [resultName]: [result.value] }),
        };
      }
      return result;
    }
  };

  // TODO if name is unspecified use the name of the stage
  stageFn.named = (name: string) => parserStage(fn, name);
  stageFn.mapResults = mapResults;
  stageFn.debug = (name: string) => {
    debug = name;
    return stageFn;
  };

  stageFn.map = <U>(fn: (result: T) => U | null) =>
    mapResults((results) => fn(results.value));

  function mapResults<U>(
    fn: (results: ExtendedResult<T>) => U | null
  ): ParserStage<U | true> {
    return parserStage((state: ParserContext): OptParserResult<U | true> => {
      const start = state.lexer.position();
      const origResults = stageFn(state);
      if (origResults === null) return null;
      const end = state.lexer.position();
      const extended = { ...origResults, start, end, results: state.app };
      const mappedValue = fn(extended);
      if (mappedValue === null) return null;
      const value = mappedValue === undefined ? true : mappedValue;

      return { value, named: origResults.named };
    });
  }

  return stageFn;
}

/** Parse for a particular kind of token,
 * @return the matching text */
export function kind(kind: string): ParserStage<string> {
  return parsing((state: ParserContext): string | null => {
    const next = state.lexer.next();
    return next?.kind === kind ? next.text : null;
  });
}

/** Parse for a token containing a text value
 * @return the kind of token that matched */
export function text(value: string): ParserStage<string> {
  return parsing((state: ParserContext): string | null => {
    const next = state.lexer.next();
    return next?.text === value ? next.kind : null;
  });
}

/** Try parsing with one or more parsers,
 *  @return the first successful parse */
export function or<T = Token>(a: ParserStageArg<T>): ParserStage<T>;
export function or<T = Token, U = Token>(
  a: ParserStageArg<T>,
  b: ParserStageArg<U>
): ParserStage<T | U>;
export function or<T = Token, U = Token, V = Token>(
  a: ParserStageArg<T>,
  b: ParserStageArg<U>,
  c: ParserStageArg<V>
): ParserStage<T | U | V>;
export function or<T = Token, U = Token, V = Token, W = Token>(
  a: ParserStageArg<T>,
  b: ParserStageArg<U>,
  c: ParserStageArg<V>,
  d: ParserStageArg<W>
): ParserStage<T | U | V | W>;
export function or<T = Token, U = Token, V = Token, W = Token, X = Token>(
  a: ParserStageArg<T>,
  b: ParserStageArg<U>,
  c: ParserStageArg<V>,
  d: ParserStageArg<W>,
  e: ParserStageArg<X>
): ParserStage<T | U | V | W | X>;
export function or<
  T = Token,
  U = Token,
  V = Token,
  W = Token,
  X = Token,
  Y = Token
>(
  a: ParserStageArg<T>,
  b: ParserStageArg<U>,
  c: ParserStageArg<V>,
  d: ParserStageArg<W>,
  e: ParserStageArg<X>,
  f: ParserStageArg<Y>
): ParserStage<T | U | V | W | X | Y>;
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

/** Parse a sequence of parsers
 * @return an array of all parsed results, or null if any parser fails */
export function seq<T = Token, U = Token>(
  a: ParserStageArg<T>
): ParserStage<[T]>;
export function seq<T = Token, U = Token>(
  a: ParserStageArg<T>,
  b: ParserStageArg<U>
): ParserStage<[T, U]>;
export function seq<T = Token, U = Token, V = Token>(
  a: ParserStageArg<T>,
  b: ParserStageArg<U>,
  c: ParserStageArg<V>
): ParserStage<[T, U, V]>;
export function seq<T = Token, U = Token, V = Token, W = Token>(
  a: ParserStageArg<T>,
  b: ParserStageArg<U>,
  c: ParserStageArg<V>,
  d: ParserStageArg<W>
): ParserStage<[T, U, V, W]>;
export function seq<T = Token, U = Token, V = Token, W = Token, X = Token>(
  a: ParserStageArg<T>,
  b: ParserStageArg<U>,
  c: ParserStageArg<V>,
  d: ParserStageArg<W>,
  e: ParserStageArg<X>
): ParserStage<[T, U, V, W, X]>;
export function seq<
  T = Token,
  U = Token,
  V = Token,
  W = Token,
  X = Token,
  Y = Token
>(
  a: ParserStageArg<T>,
  b: ParserStageArg<U>,
  c: ParserStageArg<V>,
  d: ParserStageArg<W>,
  e: ParserStageArg<X>,
  f: ParserStageArg<Y>
): ParserStage<[T, U, V, W, X, Y]>;
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
      namedResults = mergeNamed(namedResults, result.named);
      values.push(result.value);
    }
    return { value: values, named: namedResults };
  });
}

/** Try a parser.
 *
 * If the parse succeeds, return the result.
 * If the parser fails, return false and don't advance the input. Returning false
 * indicates a successful parse, so combinators like seq() will succeed.
 */
export function opt<T>(stage: string): ParserStage<string | boolean>;
export function opt<T>(stage: ParserStage<T>): ParserStage<T | boolean>;
export function opt<T>(
  stage: ParserStageArg<T>
): ParserStage<T | string | boolean> {
  return parserStage(
    (state: ParserContext): OptParserResult<T | string | boolean> => {
      const parser = parserArg(stage);
      const result = parser(state);
      return result || { value: false, named: {} };
    }
  );
}

/** yield one token, unless it matches the provided parser */ // TODO shouldn't consume match..
export function not<T>(stage: ParserStageArg<T>): ParserStage<Token | true> {
  return parserStage((state: ParserContext): OptParserResult<Token | true> => {
    const result = parserArg(stage)(state);
    if (result) {
      return null;
    } else {
      const next = state.lexer.next();
      return next ? { value: next, named: {} } : null;
    }
  });
}

/** yield next token, any token */ 
export function any(): ParserStage<Token> {
  return parsing((state: ParserContext): Token | null => {
    const next = state.lexer.next();
    return next || null;
  });
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
          results = mergeNamed(results, result.named);
        } else {
          return { value: values, named: results };
        }
      }
    }
  );
}

/** run a parser with a provided token matcher (i.e. use a temporary lexing mode) */
export function tokens<T>(
  matcher: TokenMatcher,
  arg: ParserStageArg<T>
): ParserStage<T | string> {
  return parserStage((state: ParserContext): OptParserResult<T | string> => {
    return state.lexer.withMatcher(matcher, () => {
      const parser = parserArg(arg);
      return parser(state);
    });
  });
}

/** A delayed parser definition, for making recursive parser definitions. */
export function fn<T>(fn: () => ParserStage<T>): ParserStage<T | string> {
  return parserStage((state: ParserContext): OptParserResult<T | string> => {
    const stage = parserArg(fn());
    return stage(state);
  });
}

/** convert naked string arguments into kind() parsers */ // LATEr consider converting to text() parser instead
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
