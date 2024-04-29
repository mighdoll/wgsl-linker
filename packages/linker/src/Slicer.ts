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
  const lastProgress = finalProgress(slicePogress);

  const { results, entries } = lastProgress;
  const text = results.join("");
  const srcMap = new SrcMap(text, entries);
  return srcMap;

  /** visit one slice, return progress */
  function oneSlice(
    slice: SliceReplace,
    progress: SlicingProgress
  ): SlicingProgress {
    let { srcPos, destPos } = progress;
    const { results, entries } = progress;

    // update text with copy and replacement
    const copyText = src.slice(srcPos, slice.start);
    results.push(copyText);
    results.push(slice.replacement);

    // update srcMap entries with copy and replacement
    const newEntries = replacementEntries(src, slice, progress);
    const allEntries = entries.concat(newEntries);

    // update positions in src and dest
    srcPos = slice.end;
    destPos += copyText.length + slice.replacement.length;
    dlog({srcPos, destPos, copyText})

    return { srcPos, destPos, results, entries: allEntries };
  }

  /** 
   * If there's any trailing text uncovered by the slices before the end, 
   * process it (by synthesizing a SliceReplace entry to duplicate the trailing text)
   * 
   * @return the accumulated progress 
  */
  function finalProgress(progress: SlicingProgress[]): SlicingProgress {
    const lastProgress = last(progress) ?? initProgress;
    // dlog({lastProgress})
    const { srcPos } = lastProgress;
    dlog({srcPos, end})
    if (srcPos >= end) {
      return lastProgress;
    }

    const replacement = src.slice(srcPos, end);
    dlog({replacement})
    const result = oneSlice({ start: srcPos, end, replacement}, lastProgress);
    dlog({result})
    return result;
  }
}

function replacementEntries(
  src: string,
  slice: SliceReplace,
  progress: SlicingProgress
): SrcMapEntry[] {
  const { srcPos, destPos } = progress;
  // entry for the unreplaced text copied before the replacemenent
  const copyLength = slice.start - srcPos;
  const destCopyEnd = destPos + copyLength;
  const copyEntry: SrcMapEntry = {
    src,
    srcStart: srcPos,
    srcEnd: slice.start,
    destStart: destPos,
    destEnd: destCopyEnd,
  };
  if (copyLength === 0) return [copyEntry];

  // entry for the replaced text
  const replaceEntry: SrcMapEntry = {
    src,
    srcStart: slice.start,
    srcEnd: slice.end,
    destStart: destCopyEnd,
    destEnd: destCopyEnd + slice.replacement.length,
  };

  return [copyEntry, replaceEntry];
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
