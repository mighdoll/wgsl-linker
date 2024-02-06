import { ExtendedResult, ParserContext } from "./Parser.js";
import { logger } from "./ParserTracing.js";
import { FoundRef } from "./TraverseRefs.js";

/** log an message along with the source line and a caret indicating the error position in the line */
export function srcLog(src: string, pos: number, ...msgs: any[]): void {
  logger(...msgs);
  const { line, lineNum, linePos } = srcLine(src, pos);
  logger(line, `(Ln ${lineNum})`);
  const caret = " ".repeat(linePos) + "^";
  logger(caret);
}

export function resultLog<T>(result: ExtendedResult<T>, ...msgs: any[]): void {
  srcLog(result.src, result.start, ...msgs);
}

export function refLog(ref: FoundRef, ...msgs: any[]): void {
  if (ref.kind !== "gen") {
    srcLog(ref.expMod.src, ref.elem.start, ...msgs);
  } else {
    logger(ref.name, ...msgs);
  }
}

export function ctxLog(ctx: ParserContext, ...msgs: any[]): void {
  srcLog(ctx.lexer.src, ctx.lexer.position(), ...msgs);
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

/** return the line in the src containing a given character postion */
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
    const mid = (start + end) >> 1;
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

/** return an array of the character positions of the start of each line in the src.
 * cached to avoid recomputation */
function getStarts(src: string): number[] {
  const found = startCache.get(src);
  if (found) return found;
  const starts = [...src.matchAll(/\n/g)].map((m) => m.index! + 1);
  starts.unshift(0);
  startCache.set(src, starts);

  return starts;
}
