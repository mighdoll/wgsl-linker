import {
  argsTokens,
  lineCommentTokens
} from "./MatchWgslD.js";
import {
  any,
  eof,
  fn,
  kind,
  not,
  opt,
  or,
  ParserStage,
  ParserStageArg,
  repeat,
  seq,
  tokens
} from "./ParserCombinator.js";
import { logErr } from "./TraverseRefs.js";

/* Basic parsing functions for comment handling, eol, etc. */

export const eol = or("\n", eof());

export const unknown = any().map((r) => logErr("???", r.value, r.start));

// prettier-ignore
export const skipLineComment = seq(
  "//",
  tokens(lineCommentTokens, seq(
    repeat(
      seq(not(eol), any())
    ), eol)
  )
).traceName("skipLineComment");

export const skipBlockComment: ParserStage<any> = seq(
  "/*",
  repeat(
    or(
      fn(() => skipBlockComment),
      seq(not("*/"), any())
    )
  ),
  "*/"
).traceName("skipBlockComment");

export const comment = opt(or(skipLineComment, skipBlockComment));


const a = argsTokens;

/** ( <a> <,b>* )  with optional comments interspersed */
export const wordArgs: ParserStage<string[]> = seq( // TODO specify tokenizer for this
  "(",
  withSep(",", kind(a.word)), 
  ")"
)
  .map((r) => r.value[1])
  .traceName("wordArgs");

const wordNum = or(kind(a.word), kind(a.digits));

export const wordNumArgs: ParserStage<string[]> = seq(// TODO specify tokenizer for this
  "(",
  withSep(",", wordNum),
  ")"
)
  .map((r) => r.value[1])
  .traceName("wordNumArgs");


/** match an optional series of elements separated by a delimiter (e.g. a comma) 
 * also skips embedded comments
*/
export function withSep<T>(
  sep: ParserStageArg<any>,
  p: ParserStage<T>
): ParserStage<T[]> {
  return seq(
    comment,
    p.named("elem"),
    repeat(seqWithComments(sep, p.named("elem")))
  )
    .map((r) => r.named.elem as T[])
    .traceName("withSep");
}

/** match a sequence with optional embedded comments */
export function seqWithComments(...args: ParserStageArg<any>[]): ParserStage<any> {
  const commentsAfter = args.flatMap((a) => [a, comment]);
  const newArgs = [comment, ...commentsAfter];
  return seq(...newArgs);
}

/** match everything until a terminator (and the terminator too), with optional embedded comments */
export function anyUntil(arg: ParserStageArg<any>): ParserStage<any> {
  return seq(repeat(seqWithComments(not(arg), any())), arg);
}
