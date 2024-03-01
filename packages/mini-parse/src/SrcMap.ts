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
  entriesMap = new Map<string, SrcMapEntry[]>();
  dest: string;
  constructor(dest: string) {
    this.dest = dest;
  }

  addEntries(src: string, newEntries: SrcMapEntry[]): void {
    const entriesMap = this.entriesMap;
    const entries = entriesMap.get(src) || [];
    entriesMap.set(src, entries);
    entries.push(...newEntries);
  }

  mapPositions(src: string, ...positions: number[]): number[] {
    dlog({entriesMap: this.entriesMap});
    const entries = this.entriesMap.get(src);
    if (!entries) throw new Error(`no SrcMap entries for src: ${src}`);
    return positions.map((p) => mapPos(p, entries));
  }
}

function mapPos(pos: number, entries: SrcMapEntry[]): number {
  const entry = entries.find((e) => e.destStart <= pos && e.destEnd >= pos);
  if (!entry) throw new Error(`no SrcMapEntry for pos: ${pos}`);
  return entry.srcStart + pos - entry.destStart;
}
