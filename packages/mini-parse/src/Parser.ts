import { Lexer } from "./MatchingLexer.js";
import { ParseError } from "./ParserCombinator.js";
import { srcLog } from "./ParserLogging.js";
import {
  TraceContext,
  TraceOptions,
  parserLog,
  tracing,
  withTraceLogging,
} from "./ParserTracing.js";
import { mergeNamed } from "./ParserUtil.js";
import { SrcMap } from "./SrcMap.js";

export interface AppState<A> {
  /**
   * Context for user written parsers while parsing. e.g. for nested #if state
   * The context value is reset to its original value if the parser fails.
   * Set context to a new immutable value to update (don't internally mutate context)
   */
  context: A;

  /** typical place for user written parsers to accumulate results, e.g. syntax tree */
  state: any;
}

export interface ParserInit<A = any> {
  /** supply tokens to the parser*/
  lexer: Lexer;

  /** application specific context and result storage, shared with every parser */
  app?: AppState<A>;

  /** set this to avoid infinite looping by failing after more than this many parsing steps */
  maxParseCount?: number;

  /** if this text was preprocessed */
  srcMap?: SrcMap;
}

/* Information passed to the parsers during parsing */
export interface ParserContext<A = any> {
  lexer: Lexer;

  app: AppState<A>;

  maxParseCount?: number;

  /** during execution, debug trace logging */
  _trace?: TraceContext;

  /** during execution, count parse attempts to avoid infinite looping */
  _parseCount: number;

  _preParse: Parser<unknown>[];

  /** positions where the preparse has failed to match, so no need to retry */
  _preCacheFails: Map<Parser<unknown>, Set<number>>;

  srcMap?: SrcMap;
}

/** Result from a parser */
export interface ParserResult<T> {
  /** result from this stage */
  value: T;

  /** named results from this stage and all child stages*/
  named: Record<string | symbol, any[]>;
}

export interface ExtendedResult<T, A = any> extends ParserResult<T> {
  src: string;
  srcMap?: SrcMap;
  start: number;
  end: number;
  app: AppState<A>;
  ctx: ParserContext<A>;
}

/** parsers return null if they don't match */
export type OptParserResult<T> = ParserResult<T> | null;

/** Internal parsing functions return a value and also a set of named results from contained parser  */
type ParseFn<T> = (context: ParserContext) => OptParserResult<T>;

/** options for creating a core parser */
export interface ParserArgs {
  /** name to use for result in named results */
  resultName?: string | symbol;

  /** name to use for trace logging */
  traceName?: string;

  /** enable trace logging */
  trace?: TraceOptions;

  /** true for elements without children like kind(), and text(),
   * (to avoid intro log statement while tracing) */
  terminal?: boolean;

  preDisabled?: true;
}

interface ConstructArgs<T> extends ParserArgs {
  fn: ParseFn<T>;
}

/** a composable parsing element */
export class Parser<T> {
  tracingName: string | undefined;
  namedResult: string | symbol | undefined;
  traceOptions: TraceOptions | undefined;
  terminal: boolean | undefined;
  preDisabled: true | undefined;
  fn: ParseFn<T>;

  constructor(args: ConstructArgs<T>) {
    this.tracingName = args.traceName;
    this.namedResult = args.resultName;
    this.traceOptions = args.trace;
    this.terminal = args.terminal;
    this.preDisabled = args.preDisabled;
    this.fn = args.fn;
  }

  /** copy this parser with slightly different settings */
  _cloneWith(p: Partial<ConstructArgs<T>>): Parser<T> {
    return new Parser({
      traceName: this.tracingName,
      resultName: this.namedResult,
      trace: this.traceOptions,
      terminal: this.terminal,
      preDisabled: this.preDisabled,
      fn: this.fn,
      ...p,
    });
  }

  /** run the parser given an already created parsing context */
  _run(context: ParserContext): OptParserResult<T> {
    return runParser(this, context);
  }

  /**
   * tag results with a name,
   *
   * named results can be retrived with map(r => r.named.myName)
   * note that named results are collected into an array,
   * multiple matches with the same name (even from different nested parsers) accumulate
   */
  named(name: string | symbol): Parser<T> {
    return this._cloneWith({ resultName: name });
  }

  /** record a name for debug tracing */
  traceName(name: string): Parser<T> {
    return this._cloneWith({ traceName: name });
  }

  /** trigger tracing for this parser (and by default also this parsers descendants) */
  trace(opts: TraceOptions = {}): Parser<T> {
    return this._cloneWith({ trace: opts });
  }

  /** map results to a new value, or add to app state as a side effect */
  map<U>(fn: ParserMapFn<T, U>): Parser<U> {
    return map(this, fn);
  }

  /** switch next parser based on results */
  toParser<U>(fn: ToParserFn<T, U>): Parser<T | U> {
    return toParser(this, fn);
  }

  /** start parsing */
  parse(init: ParserInit): OptParserResult<T> {
    try {
      const {
        lexer,
        maxParseCount,
        srcMap,
        app = { context: {}, state: [] },
      } = init;
      return this._run({
        lexer,
        app,
        srcMap,
        _preParse: [],
        _parseCount: 0,
        _preCacheFails: new Map(),
        maxParseCount,
      });
    } catch (e) {
      if (!(e instanceof ParseError)) {
        console.error(e);
      }
      return null;
    }
  }

  get debugName(): string {
    return this.tracingName ?? this.namedResult?.toString() ?? "parser";
  }
}

/** Create a Parser from a ParseFn
 * @param fn the parser function
 * @param args static arguments provided by the user as the parser is constructed
 */
export function parser<T>(
  traceName: string,
  fn: ParseFn<T>,
  terminal?: boolean
): Parser<T> {
  const terminalArg = terminal ? { terminal } : {};
  return new Parser<T>({ fn, traceName, ...terminalArg });
}

/** Create a Parser from a function that parses and returns a value (w/no child parsers) */
export function simpleParser<T>(
  traceName: string,
  fn: (ctx: ParserContext) => T | null | undefined
): Parser<T> {
  const parserFn: ParseFn<T> = (ctx: ParserContext) => {
    const r = fn(ctx);
    if (r == null || r === undefined) return null;

    return { value: r, named: {} };
  };

  return parser(traceName, parserFn, true);
}

/** modify the trace name of this parser */
export function setTraceName(parser: Parser<any>, traceName: string): void {
  parser.tracingName = traceName;
}

/**
 * Execute a parser by running the core parsing fn given the parsing context
 * also:
 * . check for infinite loops
 * . log if tracing is enabled
 * . merge named results
 * . backtrack on failure
 * . rollback context on failure
 */
function runParser<T>(
  p: Parser<T>,
  context: ParserContext
): OptParserResult<T> {
  const { lexer, _parseCount = 0, maxParseCount } = context;

  // check for infinite looping
  context._parseCount = _parseCount + 1;
  if (maxParseCount && _parseCount > maxParseCount) {
    srcLog(lexer.src, lexer.position(), "infinite loop? ", p.debugName);
    return null;
  }

  const origAppContext = context.app.context;
  const origPosition = lexer.position();

  // setup trace logging if enabled and active for this parser
  return withTraceLogging<OptParserResult<T>>()(
    context,
    p.traceOptions,
    (tContext) => {
      const traceSuccessOnly = tContext._trace?.successOnly;
      if (!p.terminal && tracing && !traceSuccessOnly)
        parserLog(`..${p.tracingName}`);

      if (!p.preDisabled) {
        execPreParsers(tContext);
      } else {
        tContext._preParse = [];
      }

      // run the parser function for this stage
      const result = p.fn(tContext);

      if (result === null || result === undefined) {
        // parser failed
        tracing && !traceSuccessOnly && parserLog(`x ${p.tracingName}`);
        // parserLog("reset position to:", origPosition)
        lexer.position(origPosition);
        context.app.context = origAppContext;
        return null;
      } else {
        // parser succeded
        tracing && parserLog(`✓ ${p.tracingName}`);
        if (p.namedResult && result.value !== undefined) {
          // merge named result (if user set a name for this stage's result)
          return {
            value: result.value,
            named: mergeNamed(result.named, {
              [p.namedResult]: [result.value],
            }),
          };
        }
        return { value: result.value, named: result.named };
      }
    }
  );
}

function execPreParsers(ctx: ParserContext): void {
  const { _preParse, _preCacheFails, lexer } = ctx;

  const ctxNoPre = { ...ctx, _preParse: [] };
  _preParse.forEach((pre) => {
    // get the cache of failed positions for this pre-parser
    const failCache = _preCacheFails.get(pre) || new Set();
    _preCacheFails.set(pre, failCache);

    // exec each pre-parser until it fails
    let position: number;
    let preResult: OptParserResult<unknown>;
    do {
      position = lexer.position();
      if (failCache.has(position)) break;

      preResult = pre._run(ctxNoPre);
    } while (preResult !== null && preResult !== undefined);

    failCache.add(position);
    lexer.position(position); // reset position to end of last successful parse
  });
}

type ParserMapFn<T, U> = (results: ExtendedResult<T>) => U | null;

/** return a parser that maps the current results */
function map<T, U>(p: Parser<T>, fn: ParserMapFn<T, U>): Parser<U> {
  return parser(`map`, (ctx: ParserContext): OptParserResult<U> => {
    const extended = runExtended(ctx, p);
    if (!extended) return null;

    const mappedValue = fn(extended);
    if (mappedValue === null) return null;

    return { value: mappedValue, named: extended.named };
  });
}

type ToParserFn<T, N> = (results: ExtendedResult<T>) => Parser<N> | undefined;

function toParser<T, N>(
  p: Parser<T>,
  toParserFn: ToParserFn<T, N>
): Parser<T | N> {
  return parser("toParser", (ctx: ParserContext): OptParserResult<T | N> => {
    const extended = runExtended(ctx, p);
    if (!extended) return null;

    // run the supplied function to get a parser
    const newParser = toParserFn(extended);

    if (newParser === undefined) {
      return extended;
    }

    // run the parser returned by the supplied function
    const nextResult = newParser._run(ctx);
    return nextResult;
  });
}

const emptySet = new Set<string>();

/** set which token kinds to ignore while executing this parser and its descendants.
 * If no parameters are provided, no tokens are ignored. */
export function tokenSkipSet<T>(
  ignore: Set<string> | undefined | null,
  mainParser: Parser<T>
): Parser<T> {
  const ignoreSet = ignore ?? emptySet;
  return parser(
    `tokenIgnore ${[...ignoreSet.values()]}`,
    (ctx: ParserContext): OptParserResult<T> =>
      ctx.lexer.withIgnore(ignoreSet, () => mainParser._run(ctx))
  );
}

/** attach a pre-parser to try parsing before this parser runs.
 * (e.g. to recognize comments that can appear almost anywhere in the main grammar) */
export function preParse<T>(
  pre: Parser<unknown>,
  mainParser: Parser<T>
): Parser<T> {
  return parser("preParse", (ctx: ParserContext): OptParserResult<T> => {
    const newCtx = { ...ctx, _preParse: [pre, ...ctx._preParse] };
    return mainParser._run(newCtx);
  });
}

/** disable a previously attached pre-parser,
 * e.g. to disable a comment preparser in a quoted string parser */
export function disablePreParse<T>(parser: Parser<T>): Parser<T> {
  return parser._cloneWith({ preDisabled: true });
}

/** run parser, return extended results to support map() or toParser() */
export function runExtended<T>(
  ctx: ParserContext,
  p: Parser<T>
): ExtendedResult<T> | null {
  const origStart = ctx.lexer.position();

  const origResults = p._run(ctx);
  if (origResults === null) {
    ctx.lexer.position(origStart);
    return null;
  }
  const end = ctx.lexer.position();
  const src = ctx.lexer.src;

  // we've succeeded, so refine the start position to skip past ws
  // (we don't consume ws earlier, in case an inner parser wants to use different ws skipping)
  ctx.lexer.position(origStart);
  const start = ctx.lexer.skipIgnored();
  ctx.lexer.position(end);
  const { app, srcMap } = ctx;

  return { ...origResults, start, end, app, src, srcMap, ctx };
}
