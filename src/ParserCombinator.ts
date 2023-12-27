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
 *    propagate up to containing parsers for convenience in selecting key results
 *    from other syntax.
 *
 * Built in parsers and combinators are available:
 *  kind() recognizes tokens of a particular type.
 *  or(), seq(), opt(), and repeat() combine other stages.
 *
 * Users construct their own parsers by combining other parser stages but also
 * by supplying custom functions to parsing(). Custom functions
 * are supplied an array for returning application specific results.
 * Custom parsers typically return a value to containing parsers for intermediate
 * results, and add results to the results array when a semantic phrase is
 * fully parsed.
 *
 * Custom functions are also supplied the lexer so that they can temporarily change
 * lexing mode (e.g. while processing comments or strings)
 */

/** Information passed to the parsers during parsing */
export interface ParserContext {
  /** supply tokens to the parser*/
  lexer: Lexer;

  /** for user written parsers to accumulate parsing results */
  results: any[];
}

/** Result from a parser */
export interface ParserResult<T> {
  /** result from this stage */
  value: T;

  /** named results from this stage and all child stages*/
  named: Record<string, any[]>;
}
/** parsers return null if they don't match */
export type OptParserResult<T> = ParserResult<T> | null;

/** a composable parsing element */
export interface ParserStage<T> {
  (state: ParserContext): OptParserResult<T>;
  named(name: string): ParserStage<T>;
  map<U>(fn: (result: ParserResult<T>) => OptParserResult<U>): ParserStage<U>;
}

/** Internal parsing functions return a value and also a set of named results from contained parser  */
type StageFn<T> = (state: ParserContext) => OptParserResult<T>;

/** parser combinators like or() and seq() combine other stages (strings are converted to kind() parsers) */
type ParserStageArg<T> = ParserStage<T> | string;

/** Convert a parsing function to a parser stage for use with combinators. */
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

/** wrap a parsing stage function to create a ParserStage */
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
    } else if (resultName) {
      return {
        value: result.value,
        named: mergeNamed(result.named, { [resultName]: [result.value] }),
      };
    } else {
      return result;
    }
  };

  stageFn.named = (name: string) => parserStage(fn, name);
  stageFn.map = <U>(fn: (results: ParserResult<T>) => OptParserResult<U>) => {
    const b = parserStage((state: ParserContext): OptParserResult<U> => {
      const r = stageFn(state);
      if (r === null) return null;
      // return r === null ? null : fn(r);
      const x = fn(r);
      return x;
    }, resultName);
    return b;
  };

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

/** Try parsing with one or more parsers,
 *  @return the first successful parse */
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

/** Parse a sequence of parsers
 * @return an array of all parsed results, or null if any parser fails */
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
