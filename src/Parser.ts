import { Lexer } from "./MatchingLexer.js";
import {
  TraceContext,
  TraceOptions,
  logger,
  parserLog,
  tracing,
  withTraceLogging,
} from "./ParserTracing.js";

/** Information passed to the parsers during parsing */
export interface ParserContext {
  /** supply tokens to the parser*/
  lexer: Lexer;

  /** handy place for user written parsers to accumulate application results */
  app: any[];

  /** handy place for user written parsers to keep or accept context */
  appState: any;

  /** during execution, debug trace logging */
  _trace?: TraceContext;

  /** during execution, count parse attempts to avoid infinite looping */
  _parseCount?: number;

  /** set this to avoid infinite looping by failing after more than this many parsing steps */
  maxParseCount?: number;
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
}

/** Internal parsing functions return a value and also a set of named results from contained parser  */
type ParseFn<T> = (state: ParserContext) => OptParserResult<T>;

// TODO consider dropping this
/** Create a ParserStage from a function that parses and returns a value */
export function parsing<T>(
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

  return parserStage(parserFn, { traceName, terminal: true });
}

interface ParserArgs {
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

/** Create a ParserStage from a full StageFn function that returns an OptParserResult */
export function parserStage<T>(
  fn: ParseFn<T>,
  args = {} as ParserArgs
): Parser<T> {
  const { traceName, resultName, trace, terminal } = args;
  const parseWrap = (state: ParserContext): OptParserResult<T> => {
    const { lexer, _parseCount = 0, maxParseCount } = state;

    // check for infinite looping
    state._parseCount = _parseCount + 1;
    if (maxParseCount && _parseCount > maxParseCount) {
      logger("infinite loop? ", traceName);
      return null;
    }

    // setup trace logging if enabled and active for this parser
    return withTraceLogging()(state, trace, (tstate) => {
      if (!terminal && tracing) parserLog(`..${traceName}`);
      const position = lexer.position();

      // run the parser function for this stage
      const result = fn(tstate);

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
    parserStage(fn, { ...args, resultName: name, traceName: name });
  parseWrap.traceName = (name: string) =>
    parserStage(fn, { ...args, traceName: name });
  parseWrap.map = map;
  parseWrap.toParser = toParser;
  parseWrap.trace = (opts: TraceOptions = {}) =>
    parserStage(fn, { ...args, trace: opts });

  function map<U>(fn: (results: ExtendedResult<T>) => U | null): Parser<U> {
    return parserStage(
      (ctx: ParserContext): OptParserResult<U> => {
        const extended = runInternal(ctx);
        if (!extended) return null;

        const mappedValue = fn(extended);
        if (mappedValue === null) return null;

        return { value: mappedValue, named: extended.named };
      },
      { traceName: "map" }
    );
  }

  function toParser<N>(
    fn: (results: ExtendedResult<T>) => Parser<N> | undefined
  ): Parser<T | N> {
    return parserStage(
      (ctx: ParserContext): OptParserResult<T | N> => {
        const extended = runInternal(ctx);
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

  /** run local parser, return extended results */
  function runInternal(ctx: ParserContext): ExtendedResult<T> | null {
    const start = ctx.lexer.position();
    const origResults = parseWrap(ctx);
    if (origResults === null) return null;
    const end = ctx.lexer.position();
    const { app, appState } = ctx;
    const extended = { ...origResults, start, end, app, appState };
    return extended;
  }

  return parseWrap;
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
