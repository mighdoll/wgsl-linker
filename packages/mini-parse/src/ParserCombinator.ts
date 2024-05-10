/* eslint-disable @typescript-eslint/no-unused-vars */

import {
  CombinatorArg,
  OrParser,
  ParserFromArg,
  ParserFromRepeatArg,
  ParserNamesFromArg,
  ParserResultFromArg,
  SeqParser,
  SeqValues,
} from "./CombinatorTypes.js";
import { quotedText } from "./MatchingLexer.js";
import {
  ExtendedResult,
  NameRecord,
  NoNameRecord,
  OptParserResult,
  Parser,
  ParserContext,
  parser,
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
export function text(value: string): Parser<string, NoNameRecord> {
  return simpleParser(
    `text ${quotedText(value)}'`,
    (state: ParserContext): string | null => {
      const next = state.lexer.next();
      return next?.text === value ? next.text : null;
    }
  );
}

/** Parse a sequence of parsers
 * @return an array of all parsed results, or null if any parser fails */
export function seq<P extends CombinatorArg[]>(...args: P): SeqParser<P> {
  const parsers = args.map(parserArg);

  const result = parser("seq", (ctx: ParserContext) => {
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

  return result as SeqParser<P>;
}

/** Try parsing with one or more parsers,
 *  @return the first successful parse */
export function or<P extends CombinatorArg[]>(...args: P): OrParser<P> {
  const parsers = args.map(parserArg);
  const result = parser("or", (state: ParserContext) => {
    for (const p of parsers) {
      const result = p._run(state);
      if (result !== null) {
        return result;
      }
    }
    return null;
  });

  return result as OrParser<P>;
}

/** Try a parser.
 *
 * If the parse succeeds, return the result.
 * If the parser fails, return false and don't advance the input. Returning false
 * indicates a successful parse, so combinators like seq() will succeed.
 */
export function opt<P extends CombinatorArg>(
  arg: P
): ParserFromArg<P> | Parser<undefined, NoNameRecord> {
  const p = parserArg(arg);
  const result = parser("opt", (state: ParserContext): any => {
    // TODO fix any
    const result = p._run(state);
    return result || { value: undefined, named: {} };
  });
  return result as ParserFromArg<P> | Parser<undefined, NoNameRecord>; // TODO fix cast
}

/** return true if the provided parser _doesn't_ match
 * does not consume any tokens */
export function not(arg: CombinatorArg): Parser<true> {
  const p = parserArg(arg);
  return parser("not", (state: ParserContext) => {
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
export function anyNot(arg: CombinatorArg): Parser<Token> {
  return seq(not(arg), any())
    .map((r) => r.value[1])
    .traceName("anyNot");
}

/** match everything until a terminator (and the terminator too) */
export function anyThrough<A extends CombinatorArg>(
  arg: A
): Parser<[...any, ParserResultFromArg<A>], ParserNamesFromArg<A>> {
  const p = parserArg<A>(arg);
  const result = seq(repeat(anyNot(p)), p).traceName(
    `anyThrough ${p.debugName}`
  );
  return result as any; // TODO fix any type
}

/** match zero or more instances of a parser */
export function repeat<A extends CombinatorArg>(
  arg: A
): ParserFromRepeatArg<A> {
  return parser("repeat", repeatWhileFilter(arg));
}

type ResultFilterFn<T> = (
  result: ExtendedResult<T | string, any>
) => boolean | undefined;

export function repeatWhile<A extends CombinatorArg>(
  arg: A,
  filterFn: ResultFilterFn<ParserResultFromArg<A>>
): ParserFromRepeatArg<A> {
  return parser("repeatWhile", repeatWhileFilter(arg, filterFn));
}

type RepeatWhileResult<A extends CombinatorArg> = OptParserResult<
  SeqValues<A[]>,
  ParserNamesFromArg<A>
>;

function repeatWhileFilter<A extends CombinatorArg>(
  arg: A,
  filterFn: ResultFilterFn<ParserResultFromArg<A>> = () => true
): (ctx: ParserContext) => RepeatWhileResult<A> {
  const p = parserArg(arg);
  return (ctx: ParserContext): RepeatWhileResult<A> => {
    const values: ParserResultFromArg<A>[] = [];
    let results = {};
    for (;;) {
      const result = runExtended<ParserResultFromArg<A>, ParserNamesFromArg<A>>(
        ctx,
        p
      );

      // continue acccumulating until we get a null or the filter tells us to stop
      if (result !== null && filterFn(result)) {
        values.push(result.value);
        results = mergeNamed(results, result.named);
      } else {
        // always return succcess
        const r = { value: values, named: results };
        return r as any; // TODO typing of better named results
      }
    }
  };
}

/** A delayed parser definition, for making recursive parser definitions. */
// TODO make this private
export function fn<T, N extends NameRecord>(
  fn: () => Parser<T, N>
): Parser<T, N> {
  return parser("fn", (state: ParserContext): OptParserResult<T, N> => {
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
export function req<T, N extends NameRecord>(
  arg: CombinatorArg,
  msg?: string
): Parser<T | string, N> {
  const p = parserArg(arg);
  return parser("req", (ctx: ParserContext) => {
    const result = p._run(ctx);
    if (result === null) {
      ctxLog(ctx, msg ?? `expected ${p.debugName}`);
      throw new ParseError();
    }
    return result as any; // TODO rm cast?
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
export function withSep<T, N extends NameRecord>(
  sep: CombinatorArg,
  p: Parser<T, N>,
  opts: WithSepOptions = {}
): Parser<T[], N> {
  const elem = Symbol();
  const { trailing = true, requireOne = false } = opts;
  const first = requireOne ? p : opt(p);
  const last = trailing ? opt(sep) : yes();

  return seq(first.named(elem), repeat(seq(sep, p.named(elem))), last)
    .map((r) => (r.named as any)[elem]) // TODO typing
    .traceName("withSep") as any; // TODO typing
}

/** run a parser with a provided token matcher (i.e. use a temporary lexing mode) */
export function tokens<A extends CombinatorArg>(
  matcher: TokenMatcher,
  arg: A
): ParserFromArg<A> {
  const p = parserArg(arg);
  return parser(
    `tokens ${matcher._traceName}`,
    (state: ParserContext) => {
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
export function parserArg<A extends CombinatorArg>(arg: A): ParserFromArg<A> {
  if (typeof arg === "string") {
    return text(arg) as ParserFromArg<A>; // TODO fix cast
  } else if (arg instanceof Parser) {
    return arg as ParserFromArg<A>; // TODO fix cast
  }
  return fn(arg as () => ParserFromArg<A>); // TODO fix cast
}
