import { NameRecord, NoNameRecord, Parser } from "./Parser.js";


export type CombinatorArg2 =
  | Parser<any, NameRecord>
  | string
  | (() => Parser<any, NameRecord>);

/** parser combinators like or() and seq() combine other parsers (strings are converted to kind() parsers) */
export type CombinatorArg<T, N extends NameRecord = NoNameRecord> =
  | Parser<T, N>
  | string
  | (() => Parser<T, N>);

export type ArgResult<P extends CombinatorArg2> = P; 

/** Result type returned by a parser
 * @param A is a CombinatorArg. (Either a Parser, a function returning a Parser, or string.)
 */
export type ParserResultFromArg<A> =
  A extends Parser<infer R, any>
    ? R
    : A extends string
      ? string
      : A extends () => Parser<infer R, any>
        ? R
        : never;

export type ParserNamesFromArg<A> =
  A extends Parser<any, infer R>
    ? R
    : A extends string
      ? NoNameRecord
      : A extends () => Parser<any, infer R>
        ? R
        : never;

export type ParserFromArg<A> = Parser<ParserResultFromArg<A>, ParserNamesFromArg<A>>;

export type Intersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I
) => void
  ? I
  : never;

export type InferRecord<T> = { [A in keyof T]: T[A] };

export type SeqValues<P extends CombinatorArg2[]> = {
  [key in keyof P]: ParserResultFromArg<P[key]>;
};

export type SeqNames<P extends CombinatorArg2[]> = InferRecord<
  Intersection<ParserNamesFromArg<P[number]>>
>;