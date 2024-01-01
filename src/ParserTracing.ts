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
  let _debug = state._debug;
  if (_debug) {
    _debug = { ..._debug, indent: _debug.indent + 1 };
  }
  return { ...state, _debug };
}

export interface TraceLogging {
  tlog(...msgs: any[]): void;
  tstate: ParserContext;
}

/** setup trace logging inside a parser stage */
export function traceLogging(
  // _debug has trace settings from parent
  state: ParserContext,
  // trace has trace options set on this stage
  trace?: TraceOptions
): TraceLogging {
  let { _debug } = state;

  // log if we're starting or inheriting a trace and we're in any position range
  let logging: boolean = !!_debug || !!trace;
  if (logging) {
    const { start = 0, end = 1e20 } = { ..._debug, ...trace };
    const pos = state.lexer.position();
    if (pos < start || pos > end) {
      logging = false;
    }
  }

  // start inheriting tracing if deep trace is set on this stage
  if (!_debug && trace && !trace?.shallow) {
    _debug = { indent: 0, ...trace };
  }

  let tlog = () => {};

  if (logging) {
    const pad = currentIndent(_debug);
    tlog = (...msgs: any[]) => {
      parserLog(`${pad}${msgs[0]}`, ...msgs.slice(1));
    };
  }
  return { tlog, tstate: { ...state, _debug } };
}

function currentIndent(debug?: TraceContext) {
  return "  ".repeat(debug?.indent || 0);
}