import { AbstractElem } from "./AbstractElems.js";
import { argsTokens } from "./MatchWgslD.js";
import { lineCommentOptDirective } from "./ParseDirective.js";
import { ExtendedResult, Parser } from "./Parser.js";
import {
  any,
  anyNot,
  eof,
  fn,
  kind,
  opt,
  or,
  repeat,
  seq,
  withSep,
} from "./ParserCombinator.js";
import { logErr } from "./TraverseRefs.js";

/* Basic parsing functions for comment handling, eol, etc. */

// prettier-ignore
export const eolf = seq(
  opt(kind(argsTokens.ws)), 
  or("\n", eof())
).tokens(argsTokens).tokenIgnore().traceName("eolf");

export const unknown = any().map((r) => logErr("???", r.value, r.start));

export const skipBlockComment: Parser<any> = seq(
  "/*",
  repeat(
    or(
      fn(() => skipBlockComment),
      anyNot("*/")
    )
  ),
  "*/"
).traceName("skipBlockComment");

export const comment = or(
  fn(() => lineCommentOptDirective),
  skipBlockComment
).traceName("comment");

// prettier-ignore
/** ( <a> <,b>* )  with optional comments interspersed, does not span lines */
export const wordArgsLine: Parser<string[]> = 
  seq(
    "(", 
    withSep(",", kind(argsTokens.word)), 
    ")"
  )
.tokens(argsTokens)
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

/** creat an AbstractElem by pulling fields from named parse results */
export function makeElem<U extends AbstractElem>(
  kind: U["kind"],
  er: ExtendedResult<any>,
  named: (keyof U)[],
  namedArrays: (keyof U)[] = []
): U {
  const { start, end } = er;
  const nv = mapIfDefined(named, er.named as NameRecord<U>, true);
  const av = mapIfDefined(namedArrays, er.named as NameRecord<U>);
  return { kind, start, end, ...nv, ...av } as U;
}

type NameRecord<A> = Record<keyof A, string[]>;

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
