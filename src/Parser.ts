import { Lexer } from "./MatchingLexer.js";
import {
  TraceContext,
  TraceOptions,
  logger,
  parserLog,
  tracing,
  withTraceLogging,
} from "./ParserTracing.js";

export interface ParserInit {
  /** supply tokens to the parser*/
  lexer: Lexer;

  /** handy place for user written parsers to accumulate application results */
  app: any[];

  /** handy place for user written parsers to keep or accept context */
  appState: any;

  /** set this to avoid infinite looping by failing after more than this many parsing steps */
  maxParseCount?: number;
}

/* Information passed to the parsers during parsing */
export interface ParserContext extends ParserInit {
  /** during execution, debug trace logging */
  _trace?: TraceContext;

  /** during execution, count parse attempts to avoid infinite looping */
  _parseCount: number;

  _preParse: Parser<unknown>[];
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
  app: any[];
  appState: any;
}

/** parsers return null if they don't match */
export type OptParserResult<T> = ParserResult<T> | null;

/** a composable parsing element */
export interface Parser<T> {
  (state: ParserContext): OptParserResult<T>;

  /** start parsing */
  parse(start: ParserInit): OptParserResult<T>;

  /**
   * tag results with a name,
   *
   * named results can be retrived with map(r => r.named.myName)
   * note that named results are collected into an array,
   * multiple matches with the same name (even from different nested parsers) accumulate
   */
  named(name: string): Parser<T>;

  /** record a name for debug tracing */
  traceName(name: string): Parser<T>;

  /** map results to a new value, or add to app state as a side effect */
  map<U>(fn: (result: ExtendedResult<T>) => U | null): Parser<U>;

  /** switch next parser based on results */
  toParser<N>(
    fn: (result: ExtendedResult<T>) => Parser<N> | undefined
  ): Parser<T | N>;

  /** trigger tracing for this parser (and by default also this parsers descendants) */
  trace(opts?: TraceOptions): Parser<T>;

  preParse(pre: Parser<unknown>): Parser<T>;
}

/** Internal parsing functions return a value and also a set of named results from contained parser  */
type ParseFn<T> = (context: ParserContext) => OptParserResult<T>;

// TODO consider dropping this
/** Create a ParserStage from a function that parses and returns a value */
export function simpleParser<T>(
  fn: (state: ParserContext) => T | null | undefined,
  traceName?: string
): Parser<T> {
  const parserFn: ParseFn<T> = (state: ParserContext) => {
    const r = fn(state);
    if (r !== null && r !== undefined) {
      return { value: r, named: {} };
    } else {
      return null;
    }
  };

  return parser(parserFn, { traceName, terminal: true });
}

/** options for creating a core parser */
export interface ParserArgs {
  /** name to use for result in named results */
  resultName?: string;

  /** name to use for trace logging */
  traceName?: string;

  /** enable trace logging */
  trace?: TraceOptions;

  /** true for elements without children like kind(), and text(),
   * (to avoid intro log statement while tracing) */
  terminal?: boolean;
}

/** Create a ParserStage from a full ParseFn function that returns an OptParserResult
 * @param fn the parser function
 * @param args static arguments provided by the user as the parser is constructed
 */
export function parser<T>(fn: ParseFn<T>, args = {} as ParserArgs): Parser<T> {
  const { traceName, resultName, trace, terminal } = args;
  const parseWrap = (context: ParserContext): OptParserResult<T> => {
    const { lexer, _parseCount = 0, maxParseCount } = context;

    // check for infinite looping
    context._parseCount = _parseCount + 1;
    if (maxParseCount && _parseCount > maxParseCount) {
      logger("infinite loop? ", traceName);
      return null;
    }

    // setup trace logging if enabled and active for this parser
    return withTraceLogging()(context, trace, (tContext) => {
      if (!terminal && tracing) parserLog(`..${traceName}`);
      execPreParsers(tContext);

      const position = lexer.position();
      // run the parser function for this stage
      const result = fn(tContext);

      if (result === null || result === undefined) {
        // parser failed
        tracing && parserLog(`x ${traceName}`);
        lexer.position(position); // reset position to orig spot
        return null;
      } else {
        // parser succeded
        tracing && parserLog(`✓ ${traceName}`);
        if (resultName) {
          // merge named result (if user set a name for this stage's result)
          return {
            value: result.value,
            named: mergeNamed(result.named, { [resultName]: [result.value] }),
          };
        }
        // returning orig parser result is fine, no need to name patch
        return result;
      }
    });
  };

  // TODO make name param optional and use the name from a text() or kind() match?
  parseWrap.named = (name: string) =>
    parser(fn, { ...args, resultName: name, traceName: name });
  parseWrap.traceName = (name: string) =>
    parser(fn, { ...args, traceName: name });
  parseWrap.trace = (opts: TraceOptions = {}) =>
    parser(fn, { ...args, trace: opts });
  parseWrap.map = <U>(fn: ParserMapFn<T, U>) => map(parseWrap as Parser<T>, fn);
  parseWrap.toParser = <U>(fn: ToParserFn<T, U>) =>
    toParser(parseWrap as Parser<T>, fn);
  parseWrap.parse = (start: ParserInit) =>
    parseWrap({ ...start, _preParse: [], _parseCount: 0 });
  parseWrap.preParse = (pre: Parser<unknown>) => preParse<T>(pre, parseWrap);

  return parseWrap;
}

function execPreParsers(ctx: ParserContext): void {
  const { _preParse, lexer } = ctx;

  const ctxNoPre = {...ctx, _preParse: []}; 
  _preParse.forEach((pre) => {
    let position = lexer.position();
    let preResult = pre(ctxNoPre);
    while (preResult !== null && preResult !== undefined) {
      position = lexer.position();
      preResult = pre(ctxNoPre);
    }
    lexer.position(position); // reset position to prev spot
  });
}

type ParserMapFn<T, U> = (results: ExtendedResult<T>) => U | null;

/** return a parser that maps the current results */
function map<T, U>(parseFn: Parser<T>, fn: ParserMapFn<T, U>): Parser<U> {
  return parser(
    (ctx: ParserContext): OptParserResult<U> => {
      const extended = runExtended(ctx, parseFn);
      if (!extended) return null;

      const mappedValue = fn(extended);
      if (mappedValue === null) return null;

      return { value: mappedValue, named: extended.named };
    },
    { traceName: "map" }
  );
}

type ToParserFn<T, N> = (results: ExtendedResult<T>) => Parser<N> | undefined;

function toParser<T, N>(
  parseFn: Parser<T>,
  fn: ToParserFn<T, N>
): Parser<T | N> {
  return parser(
    (ctx: ParserContext): OptParserResult<T | N> => {
      const extended = runExtended(ctx, parseFn);
      if (!extended) return null;

      // run the supplied function to get a parser
      const p = fn(extended);

      if (p === undefined) {
        return extended;
      }

      // run the parser returned by the supplied function
      const nextResult = p(ctx);
      return nextResult;
    },
    { traceName: "toParser" }
  );
}

function preParse<T>(pre: Parser<unknown>, mainParser: Parser<T>): Parser<T> {
  return parser(
    (ctx: ParserContext): OptParserResult<T> => {
      ctx._preParse.unshift(pre);
      const result = mainParser(ctx);
      ctx._preParse.shift();
      return result;
    },
    { traceName: "preParse" }
  );
}

/** run parser, return extended results to support map() or toParser() */
function runExtended<T>(
  ctx: ParserContext,
  parseFn: ParseFn<T>
): ExtendedResult<T> | null {
  const start = ctx.lexer.position();
  const origResults = parseFn(ctx);
  if (origResults === null) return null;
  const end = ctx.lexer.position();
  const { app, appState } = ctx;
  const extended = { ...origResults, start, end, app, appState };
  return extended;
}

/** merge arrays in liked named keys */
export function mergeNamed(
  a: Record<string, any[]>,
  b: Record<string, any[]>
): Record<string, any[]> {
  const sharedKeys = Object.keys(a).filter((k) => b[k]);
  // combine arrays from liked named keys
  const sharedEntries = sharedKeys.map((k) => [k, [...a[k], ...b[k]]]);
  const shared = Object.fromEntries(sharedEntries);
  return { ...a, ...b, ...shared }; // shared keys overwritten
}
