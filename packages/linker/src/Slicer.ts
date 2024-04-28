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

const tokenRegex = /\b(\w+)\b/gi;
/** find strings in a text -
 * found strings must be 'tokens', surrounded by spaces or punctuation
 *
 * @return SliceReplace elements
 */
export function sliceWords(
  text: string,
  replace: Record<string, string>
): SliceReplace[] {
  const tokens = [...text.matchAll(tokenRegex)];
  const find = Object.keys(replace);
  const matches = tokens.filter((m) => find.includes(m[0]));
  const slices = matches.map((m) => {
    const start = m.index;
    const end = start + m[0].length;
    const replacement = replace[m[0]];
    return { start, end, replacement };
  });
  return slices;
}
