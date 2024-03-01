import { dlog } from "berry-pretty";

export interface SrcMapEntry {
  src: string;
  srcStart: number;
  srcEnd: number;
  destStart: number;
  destEnd: number;
}

/** TODO many src strings mapping to one dest string.. */
export class SrcMap {
  entries: SrcMapEntry[] = [];
  dest: string;
  constructor(dest: string) {
    this.dest = dest;
  }

  addEntries(newEntries: SrcMapEntry[]): void {
    this.entries.push(...newEntries);
  }

  mapPositions(...positions: number[]): SrcPosition[] {
    return positions.map((p) => mapPos(p, this.entries));
  }
}

interface SrcPosition {
  src: string;
  position: number;
}

function mapPos(pos: number, entries: SrcMapEntry[]): SrcPosition {
  const entry = entries.find((e) => e.destStart <= pos && e.destEnd >= pos);
  if (!entry) throw new Error(`no SrcMapEntry for pos: ${pos}`);
  return {
    src: entry.src,
    position: entry.srcStart + pos - entry.destStart,
  };
}
