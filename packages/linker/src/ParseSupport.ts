import {
  ExtendedResult,
  Parser,
  any,
  anyNot,
  disablePreParse,
  kind,
  makeEolf,
  or,
  repeat,
  req,
  resultLog,
  seq,
  setTraceName,
  tracing,
  withSep
} from "mini-parse";
import { AbstractElem, AbstractElemBase } from "./AbstractElems.js";
import { argsTokens, mainTokens } from "./MatchWgslD.js";
import { lineCommentOptDirective } from "./ParseDirective.js";

/* Basic parsing functions for comment handling, eol, etc. */

export const word = kind(mainTokens.word);
export const wordNum = or(word, kind(mainTokens.digits));

export const unknown = any().map((r) => {
  const { kind, text } = r.value;
  resultLog(r, `??? ${kind}: '${text}'`);
});

export const blockComment: Parser<any> = seq(
  "/*",
  repeat(or(() => blockComment, anyNot("*/"))),
  req("*/")
);

export const comment = or(() => lineCommentOptDirective, blockComment);

export const eolf: Parser<any> = disablePreParse(
  makeEolf(argsTokens, argsTokens.ws)
);

/** ( a1, b1* ) with optinoal comments, spans lines */
export const wordNumArgs: Parser<string[]> = seq(
  "(",
  withSep(",", wordNum),
  req(")")
).map((r) => r.value[1]);

type ByKind<U, T> = U extends { kind: T } ? U : never;

type TagsType<U extends AbstractElem> = Record<
  Exclude<keyof U, keyof AbstractElemBase>,
  any[]
>;

/** create an AbstractElem from parse results
 * @param named keys in the tags result to copy to
 *  like named fields in the abstract elem (as a single value)
 * @param namedArray keys in the tags result to copy to
 *  like named fields in the abstract elem (as an array)
 */
export function makeElem<
  U extends AbstractElem,
  K extends U["kind"], // 'kind' of AbtractElem "fn"
  E extends ByKind<U, K>, // FnElem
  T extends TagsType<E>, // {name: string[]}
>(
  kind: K,
  er: ExtendedResult<any, Partial<T>>,
  tags: (keyof T)[] = [],
  tagArrays: (keyof T)[] = []
): Partial<E> {
  const { start, end } = er;

  const nv = mapIfDefined(tags, er.tags, true);
  const av = mapIfDefined(tagArrays, er.tags);
  return { kind, start, end, ...nv, ...av } as Partial<E>;
}

function mapIfDefined<A>(
  keys: (keyof A)[],
  array: Partial<Record<keyof A, string[]>>,
  firstElemOnly?: boolean
): Partial<Record<keyof A, string | string[]>> {
  const entries = keys.flatMap((k) => {
    const ak = array[k];
    const v = firstElemOnly ? ak?.[0] : ak;

    if (v === undefined) return [];
    else return [[k, v]];
  });
  return Object.fromEntries(entries);
}

// enableTracing();
if (tracing) {
  const names: Record<string, Parser<unknown>> = {
    skipBlockComment: blockComment,
    comment,
    wordNumArgs,
  };

  Object.entries(names).forEach(([name, parser]) => {
    setTraceName(parser, name);
  });
}
