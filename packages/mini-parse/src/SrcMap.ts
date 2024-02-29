export interface SrcMapEntry {
  srcStart: number;
  srcEnd: number;
  destStart: number;
  destEnd: number;
}

/** TODO many src strings mapping to one dest string.. */
export class SourceMap {
  entries: SrcMapEntry[] = [];
  dest = ""; 

  addEntries(src:string, dest:string, entries: SrcMapEntry[]): void {
    this.dest = dest;
    this.entries.push(...entries);
  }
  
}