import { quotedText } from "./MatchingLexer.js";
import {
  ExtendedResult,
  OptParserResult,
  Parser,
  parser,
  ParserContext,
  ParserResult,
  runExtended,
  simpleParser,
  tokenSkipSet,
} from "./Parser.js";
import { ctxLog } from "./ParserLogging.js";
import { mergeNamed } from "./ParserUtil.js";
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

export class ParseError extends Error {
  constructor(msg?: string) {
    super(msg);
  }
}

/** parser combinators like or() and seq() combine other stages (strings are converted to kind() parsers) */
export type CombinatorArg<T> = Parser<T> | string | (() => Parser<T>);

/** Parse for a particular kind of token,
 * @return the matching text */
export function kind(kindStr: string): Parser<string> {
  return simpleParser(
    `kind '${kindStr}'`,
    (state: ParserContext): string | null => {
      const next = state.lexer.next();
      return next?.kind === kindStr ? next.text : null;
    }
  );
}

/** Parse for a token containing a text value
 * @return the kind of token that matched */
export function text(value: string): Parser<string> {
  return simpleParser(
    `text ${quotedText(value)}'`,
    (state: ParserContext): string | null => {
      const next = state.lexer.next();
      return next?.text === value ? next.text : null;
    }
  );
}

/** Try parsing with one or more parsers,
 *  @return the first successful parse */
export function or<A = string>(a: CombinatorArg<A>): Parser<A>;
export function or<A = string, B = string>(
  a: CombinatorArg<A>,
  b: CombinatorArg<B>
): Parser<A | B>;
export function or<A = string, B = string, C = string>(
  a: CombinatorArg<A>,
  b: CombinatorArg<B>,
  c: CombinatorArg<C>
): Parser<A | B | C>;
export function or<A = string, B = string, C = string, D = string>(
  a: CombinatorArg<A>,
  b: CombinatorArg<B>,
  c: CombinatorArg<C>,
  d: CombinatorArg<D>
): Parser<A | B | C | D>;
export function or<A = string, B = string, C = string, D = string, E = string>(
  a: CombinatorArg<A>,
  b: CombinatorArg<B>,
  c: CombinatorArg<C>,
  d: CombinatorArg<D>,
  e: CombinatorArg<E>
): Parser<A | B | C | D | E>;
export function or<
  A = string,
  B = string,
  C = string,
  D = string,
  E = string,
  F = string,
>(
  a: CombinatorArg<A>,
  b: CombinatorArg<B>,
  c: CombinatorArg<C>,
  d: CombinatorArg<D>,
  e: CombinatorArg<E>,
  f: CombinatorArg<F>
): Parser<A | B | C | D | E | F>;
export function or<
  A = string,
  B = string,
  C = string,
  D = string,
  E = string,
  F = string,
  G = string,
>(
  a: CombinatorArg<A>,
  b: CombinatorArg<B>,
  c: CombinatorArg<C>,
  d: CombinatorArg<D>,
  e: CombinatorArg<E>,
  f: CombinatorArg<F>,
  g: CombinatorArg<G>
): Parser<A | B | C | D | E | F | G>;
export function or<
  A = string,
  B = string,
  C = string,
  D = string,
  E = string,
  F = string,
  G = string,
  H = string,
>(
  a: CombinatorArg<A>,
  b: CombinatorArg<B>,
  c: CombinatorArg<C>,
  d: CombinatorArg<D>,
  e: CombinatorArg<E>,
  f: CombinatorArg<F>,
  g: CombinatorArg<G>,
  h: CombinatorArg<H>
): Parser<A | B | C | D | E | F | G | H>;
export function or(...stages: CombinatorArg<any>[]): Parser<any> {
  const parsers = stages.map(parserArg);
  return parser("or", (state: ParserContext): ParserResult<any> | null => {
    for (const p of parsers) {
      const result = p._run(state);
      if (result !== null) {
        return result;
      }
    }
    return null;
  });
}

/** Parse a sequence of parsers
 * @return an array of all parsed results, or null if any parser fails */
export function seq<A = string>(a: CombinatorArg<A>): Parser<[A]>;
export function seq<A = string, B = string>(
  a: CombinatorArg<A>,
  b: CombinatorArg<B>
): Parser<[A, B]>;
export function seq<A = string, B = string, C = string>(
  a: CombinatorArg<A>,
  b: CombinatorArg<B>,
  c: CombinatorArg<C>
): Parser<[A, B, C]>;
export function seq<A = string, B = string, C = string, D = string>(
  a: CombinatorArg<A>,
  b: CombinatorArg<B>,
  c: CombinatorArg<C>,
  d: CombinatorArg<D>
): Parser<[A, B, C, D]>;
export function seq<A = string, B = string, C = string, D = string, E = string>(
  a: CombinatorArg<A>,
  b: CombinatorArg<B>,
  c: CombinatorArg<C>,
  d: CombinatorArg<D>,
  e: CombinatorArg<E>
): Parser<[A, B, C, D, E]>;
export function seq<
  A = string,
  B = string,
  C = string,
  D = string,
  E = string,
  F = string,
>(
  a: CombinatorArg<A>,
  b: CombinatorArg<B>,
  c: CombinatorArg<C>,
  d: CombinatorArg<D>,
  e: CombinatorArg<E>,
  f: CombinatorArg<F>
): Parser<[A, B, C, D, E, F]>;
export function seq(...stages: CombinatorArg<any>[]): Parser<any[]>;
export function seq(...stages: CombinatorArg<any>[]): Parser<any[]> {
  const parsers = stages.map(parserArg);

  return parser("seq", (ctx: ParserContext) => {
    const values = [];
    let namedResults = {};
    for (const p of parsers) {
      const result = p._run(ctx);
      if (result === null) return null;

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
export function opt(arg: string): Parser<string | boolean>;
export function opt<T>(p: Parser<T>): Parser<T | boolean>;
export function opt<T>(arg: CombinatorArg<T>): Parser<T | string | undefined>;
export function opt<T>(arg: CombinatorArg<T>): Parser<T | string | undefined> {
  const p = parserArg(arg);
  return parser(
    "opt",
    (state: ParserContext): OptParserResult<T | string | undefined> => {
      const result = p._run(state);
      return result || { value: undefined, named: {} };
    }
  );
}

/** return true if the provided parser _doesn't_ match
 * does not consume any tokens */
export function not<T>(stage: CombinatorArg<T>): Parser<true> {
  const p = parserArg(stage);
  return parser("not", (state: ParserContext): OptParserResult<true> => {
    const pos = state.lexer.position();
    const result = p._run(state);
    if (!result) {
      return { value: true, named: {} };
    }
    state.lexer.position(pos);
    return null;
  });
}

/** yield next token, any token */
export function any(): Parser<Token> {
  return simpleParser("any", (state: ParserContext): Token | null => {
    const next = state.lexer.next();
    return next || null;
  });
}

/** yield next token if the provided parser doesn't match */
export function anyNot<T>(arg: CombinatorArg<T>): Parser<Token> {
  return seq(not(arg), any())
    .map((r) => r.value[1])
    .traceName("anyNot");
}

/** match everything until a terminator (and the terminator too) */
export function anyThrough(arg: CombinatorArg<any>): Parser<any> {
  const p = parserArg(arg);
  return seq(repeat(anyNot(p)), p).traceName(`anyThrough ${p.debugName}`);
}

/** match zero or more instances of a parser */
export function repeat(stage: string): Parser<string[]>;
export function repeat<T>(stage: Parser<T>): Parser<T[]>;
export function repeat<T>(stage: CombinatorArg<T>): Parser<T[] | string[]> {
  return parser("repeat", repeatWhileFilter(stage));
}
type ResultFilterFn<T> = (
  result: ExtendedResult<T | string>
) => boolean | undefined;

export function repeatWhile<T>(
  arg: CombinatorArg<T>,
  filterFn: ResultFilterFn<T>
): Parser<(T | string)[]> {
  return parser("repeatWhile", repeatWhileFilter(arg, filterFn));
}

function repeatWhileFilter<T>(
  arg: CombinatorArg<T>,
  filterFn: ResultFilterFn<T> = () => true
): (ctx: ParserContext) => OptParserResult<T[] | string[]> {
  const p = parserArg(arg);
  return (ctx: ParserContext): OptParserResult<T[] | string[]> => {
    const values: (T | string)[] = [];
    let results = {};
    for (;;) {
      const result = runExtended<T | string>(ctx, p);

      // continue acccumulating until we get a null or the filter tells us to stop
      if (result !== null && filterFn(result)) {
        values.push(result.value);
        results = mergeNamed(results, result.named);
      } else {
        // always return succcess
        return { value: values as T[] | string[], named: results };
      }
    }
  };
}

/** A delayed parser definition, for making recursive parser definitions. */
export function fn<T>(fn: () => Parser<T>): Parser<T> {
  return parser("fn", (state: ParserContext): OptParserResult<T> => {
    const stage = fn();
    return stage._run(state);
  });
}

/** yields true if parsing has reached the end of input */
export function eof(): Parser<true> {
  return simpleParser(
    "eof",
    (state: ParserContext) => state.lexer.eof() || null
  );
}

/** if parsing fails, log an error and abort parsing */
export function req<T>(
  arg: CombinatorArg<T>,
  msg?: string
): Parser<T | string> {
  const p = parserArg(arg);
  return parser("req", (ctx: ParserContext): OptParserResult<T | string> => {
    const result = p._run(ctx);
    if (result === null) {
      ctxLog(ctx, msg ?? `expected ${p.debugName}`);
      throw new ParseError();
    }
    return result;
  });
}

/** always succeeds, does not consume any tokens */
export function yes(): Parser<true> {
  return simpleParser("yes", () => true);
}

/** always fails, does not consume any tokens */
export function no(): Parser<null> {
  return simpleParser("no", () => null);
}

export interface WithSepOptions {
  /** if true, allow an optional trailing separator (default true) */
  trailing?: boolean;
  /** if true, require at least one element (default false) */
  requireOne?: boolean;
}

/** match an optional series of elements separated by a delimiter (e.g. a comma) */
export function withSep<T>(
  sep: CombinatorArg<any>,
  p: Parser<T>,
  opts: WithSepOptions = {}
): Parser<T[]> {
  const elem = Symbol();
  const { trailing = true, requireOne = false } = opts;
  const first = requireOne ? p : opt(p);
  const last = trailing ? opt(sep) : yes();

  return seq(first.named(elem), repeat(seq(sep, p.named(elem))), last)
    .map((r) => r.named[elem] as T[])
    .traceName("withSep");
}

/** run a parser with a provided token matcher (i.e. use a temporary lexing mode) */
export function tokens<T>(
  matcher: TokenMatcher,
  arg: CombinatorArg<T>
): Parser<T | string> {
  const p = parserArg(arg);
  return parser(
    `tokens ${matcher._traceName}`,
    (state: ParserContext): OptParserResult<T | string> => {
      return state.lexer.withMatcher(matcher, () => {
        return p._run(state);
      });
    }
  );
}

/** return a parser that matches end of line, or end of file,
 * optionally preceded by white space
 * @param ws should not match \n */
export function makeEolf(matcher: TokenMatcher, ws: string): Parser<any> {
  // prettier-ignore
  return tokens(matcher, 
      tokenSkipSet(null, // disable automatic ws skipping so we can match newline
        seq(
          opt(kind(ws)), 
          or("\n", eof())
        )
      )
    )
   .traceName("eolf");
}

/** convert naked string arguments into text() parsers and functions into fn() parsers */
export function parserArg<T>(
  arg: CombinatorArg<T>
): Parser<T> | Parser<string> {
  if (typeof arg === "string") {
    return text(arg);
  } else if (arg instanceof Parser) {
    return arg;
  }
  // else arg:() => Parser<T>
  return fn(arg);
}
