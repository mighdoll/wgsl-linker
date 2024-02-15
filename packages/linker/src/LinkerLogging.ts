import { ExtendedResult, ParserContext, logger, srcLog } from "mini-parse";
import { FoundRef } from "./TraverseRefs.js";

// TODO mv to ParserLogging
export function resultLog<T>(result: ExtendedResult<T>, ...msgs: any[]): void {
  srcLog(result.src, result.start, ...msgs);
}

export function refLog(ref: FoundRef, ...msgs: any[]): void {
  if (ref.kind !== "gen") {
    srcLog(ref.expMod.src, ref.elem.start, ...msgs);
  } else {
    logger(ref.name, ...msgs);
  }
}

// TODO mv to ParserLogging
export function ctxLog(ctx: ParserContext, ...msgs: any[]): void {
  srcLog(ctx.lexer.src, ctx.lexer.position(), ...msgs);
}
