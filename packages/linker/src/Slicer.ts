import { scan } from "./Util.js";

/** specify a start,end portion of a string to be replaced */
export interface SliceReplace {
  start: number;
  end: number;
  replacement: string;
}

/**
 * Rewrite a string by replacing segments them with provided texts.
 *
 * example:
 * src:
 *  aaabbbbbc
 *     ^    ^
 *     St   End Repl='XXX'
 *
 * returns:
 *  aaaXXXc
 *
 */

export function sliceReplace(
  src: string,
  slices: SliceReplace[],
  start = 0,
  end?: number
): string {
  const results: string[] = [];
  const sorted = [...slices].sort((a, b) => a.start - b.start);
  const ends = scan(sorted, oneSlice, start);
  pushRemainder(ends);
  return results.join("");

  /** visit one slice */
  function oneSlice(slice: SliceReplace, pos: number): number {
    results.push(src.slice(pos, slice.start));
    results.push(slice.replacement);
    return slice.end;
  }

  /** copy text located after the last slice end point */
  function pushRemainder(ends: number[]): void {
    const lastEnd = ends.slice(-1)[0];
    results.push(src.slice(lastEnd ?? start, end));
  }
}
