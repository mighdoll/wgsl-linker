import {
  CombinatorArg,
  OrParser,
  ParserFromArg,
  ParserFromRepeatArg,
  TagsFromArg,
  ResultFromArg,
  SeqParser,
  SeqValues,
  AsRecordArray,
} from "./CombinatorTypes.js";
import { quotedText } from "./MatchingLexer.js";
import {
  ExtendedResult,
  TagRecord,
  NoTags,
  OptParserResult,
  Parser,
  ParserContext,
  parser,
  runExtended,
  simpleParser,
  tokenSkipSet,
  ParserResult,
} from "./Parser.js";
import { ctxLog } from "./ParserLogging.js";
import { mergeTags } from "./ParserUtil.js";
import { Token, TokenMatcher } from "./TokenMatcher.js";

/** Parsing Combinators
 *
 * The basic idea is that parsers are contructed heirarchically from other parsers.
 * Each parser is independently testable and reusable with combinators like or() and seq().
 *
 * Each parser is a function that recognizes tokens produced by a lexer
 * and returns a result.
 *  Returning null indicate failure. Tokens are not consumed on failure.
 *  Users can also use the .tag() method to tag results from a stage. Tagged results
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
export function text(value: string): Parser<string, NoTags> {
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
    let tagged = {};
    for (const p of parsers) {
      const result = p._run(ctx);
      if (result === null) return null;

      tagged = mergeTags(tagged, result.tags);
      values.push(result.value);
    }
    return { value: values, tags: tagged };
  });

  return result as SeqParser<P>;
}

export function test(): void {
  const a = seq(text("a").tag("AA"));
  const p = seq(seq(a));

  p.map((r) => {
    const s: string[] = r.tags.AA;
    console.log(s);
  });
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

const undefinedResult: ParserResult<undefined, NoTags> = {
  value: undefined,
  tags: {},
};

export type UndefinedParser = Parser<undefined, NoTags>;
/** Try a parser.
 *
 * If the parse succeeds, return the result.
 * If the parser fails, return false and don't advance the input. Returning false
 * indicates a successful parse, so combinators like seq() will succeed.
 */
export function opt<P extends CombinatorArg>(
  arg: P
): ParserFromArg<P> | UndefinedParser {
  const p = parserArg(arg);

  const result: ParserFromArg<P> | UndefinedParser = parser(
    "opt",
    (state: ParserContext) => {
      const result = p._run(state);
      // If parsing fails, we return instead a success
      // with 'undefined' as a value

      // cast the undefined result here and recover type with the ascription above
      type PR = ParserResult<ResultFromArg<P>, TagsFromArg<P>>;
      return result || (undefinedResult as PR);
    }
  );
  return result;
}

/** return true if the provided parser _doesn't_ match
 * does not consume any tokens */
export function not(arg: CombinatorArg): Parser<true> {
  const p = parserArg(arg);
  return parser("not", (state: ParserContext) => {
    const pos = state.lexer.position();
    const result = p._run(state);
    if (!result) {
      return { value: true, tags: {} };
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
): Parser<[...any, ResultFromArg<A>], TagsFromArg<A>> {
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
  filterFn: ResultFilterFn<ResultFromArg<A>>
): ParserFromRepeatArg<A> {
  return parser("repeatWhile", repeatWhileFilter(arg, filterFn));
}

type RepeatWhileResult<A extends CombinatorArg> = OptParserResult<
  SeqValues<A[]>,
  TagsFromArg<A>
>;

function repeatWhileFilter<A extends CombinatorArg>(
  arg: A,
  filterFn: ResultFilterFn<ResultFromArg<A>> = () => true
): (ctx: ParserContext) => RepeatWhileResult<A> {
  const p = parserArg(arg);
  return (ctx: ParserContext): RepeatWhileResult<A> => {
    const values: ResultFromArg<A>[] = [];
    let results = {};
    for (;;) {
      const result = runExtended<ResultFromArg<A>, TagsFromArg<A>>(ctx, p);

      // continue acccumulating until we get a null or the filter tells us to stop
      if (result !== null && filterFn(result)) {
        values.push(result.value);
        results = mergeTags(results, result.tags);
      } else {
        // always return succcess
        const r = { value: values, tags: results };
        return r as any; // TODO typing of better tagged results
      }
    }
  };
}

/** A delayed parser definition, for making recursive parser definitions. */
// TODO make this private
export function fn<T, N extends TagRecord>(
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
export function req<A extends CombinatorArg>(
  arg: A,
  msg?: string
): ParserFromArg<A> {
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
export function withSep<T, N extends TagRecord>(
  sep: CombinatorArg,
  p: Parser<T, N>,
  opts: WithSepOptions = {}
): Parser<T[], N> {
  const elem = Symbol();
  const { trailing = true, requireOne = false } = opts;
  const first = requireOne ? p : opt(p);
  const last = trailing ? opt(sep) : yes();

  return seq(first.tag(elem), repeat(seq(sep, p.tag(elem))), last)
    .map((r) => {
      const tags = r.tags as Record<symbol, T>;
      return tags[elem];
    })
    .traceName("withSep") as any;
}

/** run a parser with a provided token matcher (i.e. use a temporary lexing mode) */
export function tokens<A extends CombinatorArg>(
  matcher: TokenMatcher,
  arg: A
): ParserFromArg<A> {
  const p = parserArg(arg);
  return parser(`tokens ${matcher._traceName}`, (state: ParserContext) => {
    return state.lexer.withMatcher(matcher, () => {
      return p._run(state);
    });
  });
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
    return text(arg) as ParserFromArg<A>; // LATER fix cast
  } else if (arg instanceof Parser) {
    return arg as Parser<ResultFromArg<A>, TagsFromArg<A>>;
  }
  return fn(arg as () => ParserFromArg<A>);
}
