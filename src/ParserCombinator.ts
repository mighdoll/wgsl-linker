import { quotedText } from "./MatchingLexer.js";
import {
  OptParserResult,
  Parser,
  ParserContext,
  ParserResult,
  mergeNamed,
  parser,
  simpleParser,
} from "./Parser.js";
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
 *  or(), seq(), opt(), map() and repeat() combine other stages.
 *
 * Users construct their own parsers by combining other parser stages
 * and typically use map() to report results. Results can be stored
 * in the array app[], which is provided by the user and available for
 * all user constructed parsers.
 */

/** parser combinators like or() and seq() combine other stages (strings are converted to kind() parsers) */
export type CombinatorArg<T> = Parser<T> | string;

/** Parse for a particular kind of token,
 * @return the matching text */
export function kind(kindStr: string): Parser<string> {
  return simpleParser((state: ParserContext): string | null => {
    const next = state.lexer.next();
    return next?.kind === kindStr ? next.text : null;
  }, `kind '${kindStr}'`);
}

/** Parse for a token containing a text value
 * @return the kind of token that matched */
export function text(value: string): Parser<string> {
  return simpleParser((state: ParserContext): string | null => {
    const next = state.lexer.next();
    return next?.text === value ? next.text : null;
  }, `text ${quotedText(value)}'`);
}

/** Try parsing with one or more parsers,
 *  @return the first successful parse */
export function or<T = Token>(a: CombinatorArg<T>): Parser<T>;
export function or<T = Token, U = Token>(
  a: CombinatorArg<T>,
  b: CombinatorArg<U>
): Parser<T | U>;
export function or<T = Token, U = Token, V = Token>(
  a: CombinatorArg<T>,
  b: CombinatorArg<U>,
  c: CombinatorArg<V>
): Parser<T | U | V>;
export function or<T = Token, U = Token, V = Token, W = Token>(
  a: CombinatorArg<T>,
  b: CombinatorArg<U>,
  c: CombinatorArg<V>,
  d: CombinatorArg<W>
): Parser<T | U | V | W>;
export function or<T = Token, U = Token, V = Token, W = Token, X = Token>(
  a: CombinatorArg<T>,
  b: CombinatorArg<U>,
  c: CombinatorArg<V>,
  d: CombinatorArg<W>,
  e: CombinatorArg<X>
): Parser<T | U | V | W | X>;
export function or<
  T = Token,
  U = Token,
  V = Token,
  W = Token,
  X = Token,
  Y = Token
>(
  a: CombinatorArg<T>,
  b: CombinatorArg<U>,
  c: CombinatorArg<V>,
  d: CombinatorArg<W>,
  e: CombinatorArg<X>,
  f: CombinatorArg<Y>
): Parser<T | U | V | W | X | Y>;
export function or(...stages: CombinatorArg<any>[]): Parser<any> {
  return parser(
    (state: ParserContext): ParserResult<any> | null => {
      for (const stage of stages) {
        const parser = parserArg(stage);
        const result = parser(state);
        if (result !== null) {
          return result;
        }
      }
      return null;
    },
    { traceName: "or" }
  );
}

/** Parse a sequence of parsers
 * @return an array of all parsed results, or null if any parser fails */
export function seq<T = Token, U = Token>(a: CombinatorArg<T>): Parser<[T]>;
export function seq<T = Token, U = Token>(
  a: CombinatorArg<T>,
  b: CombinatorArg<U>
): Parser<[T, U]>;
export function seq<T = Token, U = Token, V = Token>(
  a: CombinatorArg<T>,
  b: CombinatorArg<U>,
  c: CombinatorArg<V>
): Parser<[T, U, V]>;
export function seq<T = Token, U = Token, V = Token, W = Token>(
  a: CombinatorArg<T>,
  b: CombinatorArg<U>,
  c: CombinatorArg<V>,
  d: CombinatorArg<W>
): Parser<[T, U, V, W]>;
export function seq<T = Token, U = Token, V = Token, W = Token, X = Token>(
  a: CombinatorArg<T>,
  b: CombinatorArg<U>,
  c: CombinatorArg<V>,
  d: CombinatorArg<W>,
  e: CombinatorArg<X>
): Parser<[T, U, V, W, X]>;
export function seq<
  T = Token,
  U = Token,
  V = Token,
  W = Token,
  X = Token,
  Y = Token
>(
  a: CombinatorArg<T>,
  b: CombinatorArg<U>,
  c: CombinatorArg<V>,
  d: CombinatorArg<W>,
  e: CombinatorArg<X>,
  f: CombinatorArg<Y>
): Parser<[T, U, V, W, X, Y]>;
export function seq(...stages: CombinatorArg<any>[]): Parser<any[]>;
export function seq(...stages: CombinatorArg<any>[]): Parser<any[]> {
  return parser(
    (state: ParserContext) => {
      const values = [];
      let namedResults = {};
      for (const stage of stages) {
        const parser = parserArg(stage);
        const result = parser(state);
        if (result === null) return null;

        namedResults = mergeNamed(namedResults, result.named);
        values.push(result.value);
      }
      return { value: values, named: namedResults };
    },
    { traceName: "seq" }
  );
}

/** Try a parser.
 *
 * If the parse succeeds, return the result.
 * If the parser fails, return false and don't advance the input. Returning false
 * indicates a successful parse, so combinators like seq() will succeed.
 */
export function opt<T>(stage: string): Parser<string | boolean>;
export function opt<T>(stage: Parser<T>): Parser<T | boolean>;
export function opt<T>(stage: CombinatorArg<T>): Parser<T | string | boolean> {
  return parser(
    (state: ParserContext): OptParserResult<T | string | boolean> => {
      const parser = parserArg(stage);
      const result = parser(state);
      return result || { value: false, named: {} };
    },
    { traceName: "opt" }
  );
}

/** return true if the provided parser _doesn't_ match
 * does not consume any tokens
 * */
export function not<T>(stage: CombinatorArg<T>): Parser<true> {
  return parser(
    (state: ParserContext): OptParserResult<true> => {
      const pos = state.lexer.position();
      const result = parserArg(stage)(state);
      if (!result) {
        return { value: true, named: {} };
      }
      state.lexer.position(pos);
      return null;
    },
    { traceName: "not" }
  );
}

/** yield next token, any token */
export function any(): Parser<Token> {
  return simpleParser((state: ParserContext): Token | null => {
    const next = state.lexer.next();
    return next || null;
  }, "any");
}

export function anyNot<T>(arg: CombinatorArg<T>): Parser<Token> {
  return seq(not(arg), any())
    .map((r) => r.value[1])
    .traceName("anyBut");
}

/** match everything until a terminator (and the terminator too)
 * including optional embedded comments */
export function anyThrough(arg: CombinatorArg<any>): Parser<any> {
  return seq(repeat(anyNot(arg)), arg);
}

export function repeat(stage: string): Parser<string[]>;
export function repeat<T>(stage: Parser<T>): Parser<T[]>;
export function repeat<T>(stage: CombinatorArg<T>): Parser<(T | string)[]> {
  return parser(
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
    },
    { traceName: "repeat" }
  );
}

// TODO mv to method on Parser
/** run a parser with a provided token matcher (i.e. use a temporary lexing mode) */
export function tokens<T>(matcher: TokenMatcher, arg: Parser<T>): Parser<T>;
export function tokens<T>(
  matcher: TokenMatcher,
  arg: CombinatorArg<T>
): Parser<T | string> {
  return parser(
    (state: ParserContext): OptParserResult<T | string> => {
      return state.lexer.withMatcher(matcher, () => {
        const p = parserArg(arg);
        return p(state);
      });
    },
    { traceName: `tokens ${matcher._traceName}` }
  );
}

/** A delayed parser definition, for making recursive parser definitions. */
export function fn<T>(fn: () => Parser<T>): Parser<T | string> {
  return parser((state: ParserContext): OptParserResult<T | string> => {
    const stage = parserArg(fn());
    return stage(state);
  });
}

/** yields true if parsing has reached the end of input */
export function eof(): Parser<true> {
  return simpleParser(
    (state: ParserContext) => state.lexer.eof() || null,
    "eof"
  );
}

/** match an optional series of elements separated by a delimiter (e.g. a comma) */
export function withSep<T>(sep: CombinatorArg<any>, p: Parser<T>): Parser<T[]> {
  return seq(
    p.named("_elem"),
    repeat(seq(sep, p.named("_elem")))
  )
    .map((r) => r.named._elem as T[])
    .traceName("withSep");
}

/** convert naked string arguments into text() parsers */
export function parserArg<T>(
  arg: CombinatorArg<T>
): Parser<T> | Parser<string> {
  return typeof arg === "string" ? text(arg) : arg;
}
