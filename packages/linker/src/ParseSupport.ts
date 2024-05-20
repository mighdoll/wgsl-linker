import {
  any,
  anyNot,
  disablePreParse,
  ExtendedResult,
  kind,
  makeEolf,
  TagRecord,
  or,
  Parser,
  repeat,
  req,
  resultLog,
  seq,
  setTraceName,
  tracing,
  withSep
} from "mini-parse";
import { AbstractElem } from "./AbstractElems.js";
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

export const comment = or(
  () => lineCommentOptDirective,
  blockComment
);

export const eolf: Parser<any> = disablePreParse(
  makeEolf(argsTokens, argsTokens.ws)
);

/** ( a1, b1* ) with optinoal comments, spans lines */
export const wordNumArgs: Parser<string[]> = seq(
  "(",
  withSep(",", wordNum),
  req(")")
).map((r) => r.value[1]);

/** create an AbstractElem from parse results
 * @param named keys in the tags result to copy to
 *  like named fields in the abstract elem (as a single value)
 * @param namedArray keys in the tags result to copy to
 *  like named fields in the abstract elem (as an array)
 */
export function makeElem<U extends AbstractElem>(
  kind: U["kind"],
  er: ExtendedResult<any, TagRecord>, 
  named: (keyof U)[] = [],
  namedArrays: (keyof U)[] = []
): U {
  const { start, end } = er;
  const nv = mapIfDefined(named, er.tags as NameStrings<U>, true); // TODO let ts match names, avoid cast
  const av = mapIfDefined(namedArrays, er.tags as NameStrings<U>);
  return { kind, start, end, ...nv, ...av } as U;
}

type NameStrings<A> = Record<keyof A, string[]>;

function mapIfDefined<A>(
  keys: (keyof A)[],
  array: Record<keyof A, string[]>,
  firstElem?: boolean
): Partial<Record<keyof A, string>> {
  const entries = keys.flatMap((k) => {
    const ak = array[k];
    const v = firstElem ? ak?.[0] : ak;

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
    wordNumArgs
  };

  Object.entries(names).forEach(([name, parser]) => {
    setTraceName(parser, name);
  });
}
