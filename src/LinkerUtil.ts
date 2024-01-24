export let logErr = console.error;

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
export function srcErr(src: string, pos: number, ...msgs: string[]): void {
  logErr(msgs);
  const { line, linePos } = srcLine(src, pos);
  logErr(line);
  const caret = " ".repeat(linePos) + "^";
  logErr(caret);
}

// map from src strings to line start positions
const startCache = new Map<string, number[]>();

interface SrcLine {
  /** src line w/o newline */
  line: string;

  /** requested position relative to line start */
  linePos: number;
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
    let mid = Math.floor((end - start) / 2);
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

  return { line, linePos: pos - starts[start] };
}

function getStarts(src: string): number[] {
  const found = startCache.get(src);
  if (found) return found;
  const starts = [...src.matchAll(/\n/g)].map((m) => m.index! + 1);
  starts.unshift(0);
  startCache.set(src, starts);

  return starts;
}
