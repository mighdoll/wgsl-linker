export interface SrcMapEntry {
  srcStart: number;
  srcEnd: number;
  destStart: number;
  destEnd: number;
}

export class SourceMap {
  entries: SrcMapEntry[] = [];

  addEntries(src:string, dest:string, entries: SrcMapEntry[]): void {
    this.entries.push(...entries);
  }
  
}