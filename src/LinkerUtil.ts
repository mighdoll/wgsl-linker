import { ExtendedResult, ParserContext } from "./Parser.js";

export let logErr = console.log;

/** use temporary logger for tests */
export function _withErrLogger<T>(logFn: typeof console.error, fn: () => T): T {
  const orig = logErr;
  try {
    logErr = logFn;
    return fn();
  } finally {
    logErr = orig;
  }
}

/** log an error along with the source line and a caret indicating the error position in the line */
export function srcErr(src: string, pos: number, ...msgs: any[]): void {
  logErr(...msgs);
  const { line, lineNum, linePos } = srcLine(src, pos);
  logErr(line, `(Ln ${lineNum})`);
  const caret = " ".repeat(linePos) + "^";
  logErr(caret);
}

export function resultErr<T>(result: ExtendedResult<T>, ...msgs:any[]): void {
  srcErr(result.src, result.start, ...msgs);
}

export function ctxErr(ctx: ParserContext, ...msgs: any[]): void {
  srcErr(ctx.lexer.src, ctx.lexer.position(), ...msgs);
}

// map from src strings to line start positions
const startCache = new Map<string, number[]>();

interface SrcLine {
  /** src line w/o newline */
  line: string;

  /** requested position relative to line start */
  linePos: number;

  /** line number in the src (first line is #1) */
  lineNum: number;
}

export function srcLine(src: string, pos: number): SrcLine {
  const starts = getStarts(src);

  let start = 0;
  let end = starts.length - 1;

  // short circuit search if pos is after last line start
  if (pos >= starts[end]) {
    start = end;
  }

  // binary search to find start,end positions that surround provided pos
  while (start + 1 < end) {
    let mid = (start + end) >> 1;
    if (pos >= starts[mid]) {
      start = mid;
    } else {
      end = mid;
    }
  }

  // get line with possible trailing newline
  const lineNl = src.slice(starts[start], starts[start + 1] || src.length);

  // return line without trailing newline
  const line = lineNl.slice(-1) === "\n" ? lineNl.slice(0, -1) : lineNl;

  return { line, linePos: pos - starts[start], lineNum: start + 1 };
}

function getStarts(src: string): number[] {
  const found = startCache.get(src);
  if (found) return found;
  const starts = [...src.matchAll(/\n/g)].map((m) => m.index! + 1);
  starts.unshift(0);
  startCache.set(src, starts);

  return starts;
}
