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

/** Result value type returned by a parser
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

/** parser NameRecord corresponding to a CombinatorArg
 * @param A CombinatorArg
 */
export type ParserNamesFromArg<A> =
  A extends Parser<any, infer R>
    ? R
    : A extends string
      ? NoNameRecord
      : A extends () => Parser<any, infer R>
        ? R
        : never;

/** Parser corresponding to a CombinatorArg
 * @param A CombinatorArg
 */
export type ParserFromArg<A> = Parser<
  ParserResultFromArg<A>,
  ParserNamesFromArg<A>
>;

/** Intersection of types.
 * @param U is normally a union type A | B | C
 * @return intersection of types A & B & C
 *
 * Works by placing U into contraviant position, and then inferring. 
 * See https://www.typescriptlang.org/docs/handbook/advanced-types.html#type-inference-in-conditional-types
 * and/or https://stackoverflow.com/questions/50374908/transform-union-type-to-intersection-type
 */
export type Intersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I
) => void
  ? I
  : never;

/** 
 * Define keys explictly for a Record type. 
 * Sometimes TypeScript is tempted to return a generic Record 
 * rather than specific keys for a record. 
 * 
 * e.g. the type {a: number, b: string} could be also be Record<string, number|string>
 * 
 * KeyedRecord will ask Typescript to return help the first version if possible..
 * 
 * @param T a Record type 
 * @returns a Record type with the keys explictly defined, if possible.
 */
export type KeyedRecord<T> = { [A in keyof T]: T[A] };

export type SeqValues<P extends CombinatorArg2[]> = {
  [key in keyof P]: ParserResultFromArg<P[key]>;
};

export type SeqNames<P extends CombinatorArg2[]> = KeyedRecord<
  Intersection<ParserNamesFromArg<P[number]>>
>;
