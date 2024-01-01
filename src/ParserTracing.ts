import { ParserContext, } from "./ParserCombinator.js";

export let parserLog = console.log; // exposed for testing

export interface TraceOptions {
  shallow?: boolean;
  start?: number;
  end?: number;
}

export interface TraceContext {
  indent: number;
  start?: number;
  end?: number;
}

/** swap logger for tests */
export function _withParserLog<T>(logFn: typeof console.log, fn: () => T): T {
  const orig = parserLog;
  try {
    parserLog = logFn;
    return fn();
  } finally {
    parserLog = orig;
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
  tlog(...msgs: any[]): void;
  tstate: ParserContext;
}

/** setup trace logging inside a parser stage */
export function traceLogging(
  // _trace has trace settings from parent
  state: ParserContext,
  // trace has trace options set on this stage
  trace?: TraceOptions
): TraceLogging {
  let { _trace } = state;

  // log if we're starting or inheriting a trace and we're in any position range
  let logging: boolean = !!_trace || !!trace;
  if (logging) {
    const { start = 0, end = 1e20 } = { ..._trace, ...trace };
    const pos = state.lexer.position();
    if (pos < start || pos > end) {
      logging = false;
    }
  }

  // start inheriting tracing if deep trace is set on this stage
  if (!_trace && trace && !trace?.shallow) {
    _trace = { indent: 0, ...trace };
  }

  let tlog = () => {};

  if (logging) {
    const pad = currentIndent(_trace);
    tlog = (...msgs: any[]) => {
      parserLog(`${pad}${msgs[0]}`, ...msgs.slice(1));
    };
  }
  return { tlog, tstate: { ...state, _trace: _trace } };
}

function currentIndent(debug?: TraceContext) {
  return "  ".repeat(debug?.indent || 0);
}