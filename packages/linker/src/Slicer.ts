import { SrcMap, SrcMapEntry } from "mini-parse";
import { last, scan } from "./Util.js";
import { dlog } from "berry-pretty";

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

interface SlicingProgress {
  srcPos: number;
  destPos: number;
  results: string[];
  entries: SrcMapEntry[];
}

export function sliceReplace2(
  src: string,
  slices: SliceReplace[],
  start = 0,
  end = src.length
): SrcMap {
  const sorted = [...slices].sort((a, b) => a.start - b.start);
  const initProgress = { srcPos: start, destPos: 0, results: [], entries: [] };
  const slicePogress = scan(sorted, oneSlice, initProgress);
  const lastProgress = finalProgress2(slicePogress);

  const { results, entries } = lastProgress;
  const text = results.join("");
  const srcMap = new SrcMap(text, entries);
  return srcMap;

  /** visit one slice, return progress */
  function oneSlice(
    slice: SliceReplace,
    progress: SlicingProgress
  ): SlicingProgress {

    // update text with copy and replacement
    const copyText = src.slice(progress.srcPos, slice.start);
    const copied = replaceOne(copyText, slice.end, progress);
    const replaced = replaceOne(slice.replacement, slice.end, copied);

    return replaced;
  }

  /** add text to the result and add a srcMap entry
   * @return the accumulated progress */
  function replaceOne(
    replacement: string,
    newSrcPos: number,
    progress: SlicingProgress
  ): SlicingProgress {
    if (!replacement) {
      return progress;
    }
    const { srcPos, destPos, results, entries } = progress;
    const newResults = results.concat(replacement);
    const newDestPos = destPos + replacement.length;
    const newEntries = entries.concat({
      src,
      srcStart: srcPos,
      srcEnd: newSrcPos,
      destStart: destPos,
      destEnd: newDestPos,
    });

    return {
      srcPos: newSrcPos,
      destPos: newDestPos,
      results: newResults,
      entries: newEntries,
    };
  }

  /**
   * If there's any trailing text uncovered by the slices before the end,
   * add a result and srcMap entry
   *
   * @return the accumulated progress
   */
  function finalProgress2(progress: SlicingProgress[]): SlicingProgress {
    const lastProgress = last(progress) ?? initProgress;
    const { srcPos } = lastProgress;
    return replaceOne(src.slice(srcPos, end), end, lastProgress);
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
