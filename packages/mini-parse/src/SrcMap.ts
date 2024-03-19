export interface SrcMapEntry {
  src: string;
  srcStart: number;
  srcEnd: number;
  destStart: number;
  destEnd: number;
}

export interface SrcPosition {
  src: string;
  position: number;
}

/** map text ranges in multiple src texts to a single dest text */
export class SrcMap {
  entries: SrcMapEntry[] = [];
  dest: string;
  constructor(dest: string) {
    this.dest = dest;
  }

  /** add a new mapping from src to dest ranges.
   * entries must be non-overlapping, and added in order.
   */
  addEntries(newEntries: SrcMapEntry[]): void {
    this.entries.push(...newEntries);
  }

  /** given positions in the dest string,
   * @return corresponding positions in the src strings */
  mapPositions(...positions: number[]): SrcPosition[] {
    return positions.map((p) => mapPos(p, this.entries));
  }

  /** internally compress adjacent entries where possible */
  compact(): void {
    if (!this.entries.length) return;
    let prev = this.entries[0];
    const newEntries: SrcMapEntry[] = [prev];

    for (let i = 1; i < this.entries.length; i++) {
      const e = this.entries[i];
      if (
        e.src === prev.src &&
        prev.destEnd === e.destStart &&
        prev.srcEnd === e.srcStart
      ) {
        // combine adjacent range entries into one
        prev.destEnd = e.destEnd;
        prev.srcEnd = e.srcEnd;
      } else {
        newEntries.push(e);
        prev = e;
      }
    }
    this.entries = newEntries;
  }
}

function mapPos(pos: number, entries: SrcMapEntry[]): SrcPosition {
  const entry = entries.find((e) => e.destStart <= pos && e.destEnd >= pos);
  if (!entry) throw new Error(`no SrcMapEntry for pos: ${pos}`);
  return {
    src: entry.src,
    position: entry.srcStart + pos - entry.destStart,
  };
}
