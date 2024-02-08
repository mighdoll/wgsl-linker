import { ExtendedResult, ParserContext } from "../packages/mini-parse/src/Parser.js";
import { srcLog } from "./ParserLogging.js";
import { logger } from "./ParserTracing.js";
import { FoundRef } from "./TraverseRefs.js";

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

export function ctxLog(ctx: ParserContext, ...msgs: any[]): void {
  srcLog(ctx.lexer.src, ctx.lexer.position(), ...msgs);
}