import { ParserContext } from "./ParserCombinator.js";

let logger = console.log;
export let parserLog = logger; // logger while tracing is active, otherwise noop

/** options to .trace() on a parser stage */
export interface TraceOptions {
  shallow?: boolean;
  start?: number;
  end?: number;
}

/** runtime stack info about currently active trace logging */
export interface TraceContext {
  indent: number;
  start?: number;
  end?: number;
}

/** use temporary logger, to turn tracing on/off */
export function withLogger<T>(logFn: typeof console.log, fn: () => T): T {
  const orig = parserLog;
  try {
    parserLog = logFn;
    return fn();
  } finally {
    parserLog = orig;
  }
}

/** use temporary logger for tests */
export function _withBaseLogger<T>(logFn: typeof console.log, fn: () => T): T {
  const orig = logger;
  try {
    logger = logFn;
    return fn();
  } finally {
    logger = orig;
  }
}

/** increase indent for debug trace logging, if tracing is active */
export function traceIndent(state: ParserContext): ParserContext {
  let _trace = state._trace;
  if (_trace) {
    _trace = { ..._trace, indent: _trace.indent + 1 };
  }
  return { ...state, _trace };
}

export interface TraceLogging {
  tstate: ParserContext;
}

/** setup trace logging inside a parser stage */
export function withTraceLogging<T>(
  // _trace has trace settings from parent
  ctx: ParserContext,
  // trace has trace options set on this stage
  trace: TraceOptions | undefined,
  fn: (ctxWithTracing: ParserContext) => T
): T {
  let { _trace } = ctx;

  // log if we're starting or inheriting a trace and we're in any position range
  let logging: boolean = !!_trace || !!trace;
  if (logging) {
    const { start = 0, end = 1e20 } = { ..._trace, ...trace };
    const pos = ctx.lexer.position();
    if (pos < start || pos > end) {
      logging = false;
    }
  }

  // start inheriting tracing if deep trace is set on this stage
  if (!_trace && trace && !trace?.shallow) {
    _trace = { indent: 0, ...trace };
  }

  // setup appropriate logging for this stage
  let tlog = () => {};
  if (logging) {
    const pad = currentIndent(_trace);
    tlog = (...msgs: any[]) => {
      logger(`${pad}${msgs[0]}`, ...msgs.slice(1));
    };
  }

  return withLogger(tlog, () => fn({ ...ctx, _trace }));
}

/** padding for current indent level */
function currentIndent(debug?: TraceContext) {
  return "  ".repeat(debug?.indent || 0);
}
