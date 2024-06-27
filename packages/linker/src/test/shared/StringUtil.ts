/** trim off leading indent and leading blank lines */
export function trimSrc(src: string): string {
  const rawLines = src.split("\n");
  const noLeading = dropWhile(rawLines, (l) => l.trim() === ""); // skip leading blank lines
  const lines = dropRightWhile(noLeading , (l) => l.trim() === ""); // skip trailing blank lines

  const nonBlankLines = lines.filter((l) => l.trim() !== "");
  const indents = nonBlankLines.map((l) => l.match(/^[ \t]*/)?.[0].length ?? 0);
  if (indents.length === 0) return src;

  const minIndent = indents.reduce((min, i) => Math.min(min, i));

  const trimmedLines = lines.map((l) => l.slice(minIndent));
  return trimmedLines.join("\n");
}

export function dropWhile<T>(a: T[], fn: (el: T) => boolean): T[] {
  let skip = 0;
  while (skip < a.length && fn(a[skip])) skip++;

  return a.slice(skip);
}

export function dropRightWhile<T>(a: T[], fn: (el: T) => boolean): T[] {
  let skip = a.length - 1;
  while (skip >= 0 && fn(a[skip])) skip--;

  return a.slice(0, skip + 1);
}