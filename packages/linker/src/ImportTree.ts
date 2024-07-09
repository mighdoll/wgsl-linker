export class ImportTree {
  constructor(public segments: PathSegment[]) {}
}

export type PathSegment = SimpleSegment | Wildcard | ImportTree | SegmentList;


export class SimpleSegment {
  constructor(
    public name: string,
    public as?: string
  ) {}
}

export class SegmentList {
  constructor(public list: PathSegment[]) {}
}

export class Wildcard {
  public static _ = new Wildcard();
  wildcard = "*"; // to identify this object in debug logging
}