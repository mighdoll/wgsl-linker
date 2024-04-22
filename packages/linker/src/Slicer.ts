import { scan } from "./Util.js";

export interface SliceReplace {
  start: number;
  end: number;
  replacement: string;
}

/**
 *  aaabbbbbc
 *     s    e
 *  aaarrrrrc
 *
 * @param src
 * @param slices
 * @returns
 */

export function sliceReplace(src: string, slices: SliceReplace[]): string {
  const results: string[] = [];
  const sorted = [...slices].sort((a, b) => a.start - b.start);
  const ends = scan(sorted, oneSlice, 0);
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
    results.push(src.slice(lastEnd));
  }
}
