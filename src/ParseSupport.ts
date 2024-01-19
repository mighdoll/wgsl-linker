import { argsTokens, lineCommentTokens } from "./MatchWgslD.js";
import { lineCommentOptDirective } from "./ParseDirective.js";
import { Parser, ParserStageArg } from "./Parser.js";
import {
  any,
  eof,
  fn,
  kind,
  not,
  opt,
  or,
  repeat,
  seq,
  tokens,
} from "./ParserCombinator.js";
import { logErr } from "./TraverseRefs.js";

/* Basic parsing functions for comment handling, eol, etc. */

export const eol = or("\n", eof());

export const unknown = any().map((r) => logErr("???", r.value, r.start));

export const skipBlockComment: Parser<any> = seq(
  "/*",
  repeat(
    or(
      fn(() => skipBlockComment),
      seq(not("*/"), any())
    )
  ),
  "*/"
).traceName("skipBlockComment");

export const comment = opt(or(fn(() => lineCommentOptDirective), skipBlockComment));

// prettier-ignore
/** ( <a> <,b>* )  with optional comments interspersed, does not span lines */
export const wordArgsLine: Parser<string[]> = tokens(
  argsTokens,
  seq(
    "(", 
    withSep(",", kind(argsTokens.word)), 
    ")"
  )
)
  .map((r) => r.value[1])
  .traceName("wordArgs");

const wordNum = or(kind(argsTokens.word), kind(argsTokens.digits));

/** ( a1, b1* ) with optinal comments, spans lines */
export const wordNumArgs: Parser<string[]> = seq(
  "(",
  withSep(",", wordNum),
  ")"
)
  .map((r) => r.value[1])
  .traceName("wordNumArgs");

/** match an optional series of elements separated by a delimiter (e.g. a comma)
 * handles embedded comments
 */
export function withSep<T>(
  sep: ParserStageArg<any>,
  p: Parser<T>
): Parser<T[]> {
  return seq(
    comment,
    p.named("elem"),
    repeat(seqWithComments(sep, p.named("elem")))
  )
    .map((r) => r.named.elem as T[])
    .traceName("withSep");
}

/** match a sequence with optional embedded comments */
export function seqWithComments(
  ...args: ParserStageArg<any>[]
): Parser<any> {
  const commentsAfter = args.flatMap((a) => [a, comment]);
  const newArgs = [comment, ...commentsAfter];
  return seq(...newArgs);
}

/** match everything until a terminator (and the terminator too)
 * including optional embedded comments */
export function anyUntil(arg: ParserStageArg<any>): Parser<any> {
  return seq(repeat(seqWithComments(not(arg), any())), arg);
}
