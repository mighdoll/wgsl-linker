import { logger, srcLog } from "mini-parse";
import { FoundRef } from "./TraverseRefs.js";

export function refLog(ref: FoundRef, ...msgs: any[]): void {
  if (ref.kind !== "gen") {
    const {src, srcMap: sourceMap} = ref.expMod;
    srcLog(sourceMap ?? src, ref.elem.start, ...msgs);
  } else {
    logger(ref.name, ...msgs);
  }
}
