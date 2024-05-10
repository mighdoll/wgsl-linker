import { NameRecord, NoNameRecord, Parser } from "./Parser.js";

/** parser combinators like or() and seq() combine other parsers (strings are converted to text() parsers) */
export type CombinatorArg =
  | Parser<any, NameRecord>
  | string
  | (() => Parser<any, NameRecord>);

/** 
 * @return Parser corresponding to a single CombinatorArg. 
 * 
 * examples:
 *    for combinator("some_string"), the argument is "some_string"
 *      the Parser corresponding to "some_string" is Parser<string, NoNameRecord>
 *    if the combinator argument is Parser<number[], {n:number[]}>
 *      the corresponding parser is Parser<number[], {n:number[]}>
 *    if the combinator argument is () => Parser<string, {n:number[]}>
 *      the corresponding parser is Parser<string, {n:number[]}>
*/
export type ParserFromArg<A extends CombinatorArg> = Parser<
  ParserResultFromArg<A>,
  ParserNamesFromArg<A>
>;

/** 
 * @return Parser corresponding to an array that repeats the same CombinatorArg. 
 */ 
export type ParserFromRepeatArg<A extends CombinatorArg> = Parser<
  ParserResultFromArg<A>[],
  ParserNamesFromArg<A>
>;

/** Result value type returned by a parser specified by a CombinatorArg */
export type ParserResultFromArg<A extends CombinatorArg> =
  A extends Parser<infer R, any>
    ? R
    : A extends string
      ? string
      : A extends () => Parser<infer R, any>
        ? R
        : never;

/** parser NameRecord returned by parser specified by a CombinatorArg */
export type ParserNamesFromArg<A extends CombinatorArg> =
  A extends Parser<any, infer R>
    ? R
    : A extends string
      ? NoNameRecord
      : A extends () => Parser<any, infer R>
        ? R
        : never;


/** Intersection of types.
 * @param U is normally a union type, e.g. A | B | C
 * @return type intersection version of U, e.g. A & B & C
 *
 * Works by placing U into contraviant position, and then inferring its type.
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

/** Parser type returned by seq(), 
 *    concatenates the argument result types into an array
 *    and intersects the argument name records into a single keyed record.
 * @param P type of arguments to seq()
 */
export type SeqParser<P extends CombinatorArg[]> = Parser<
  SeqValues<P>,
  SeqNames<P>
>;

export type SeqValues<P extends CombinatorArg[]> = {
  [key in keyof P]: ParserResultFromArg<P[key]>;
};

type SeqNames<P extends CombinatorArg[]> = KeyedRecord<
  Intersection<ParserNamesFromArg<P[number]>>
>;

export type OrParser<P extends CombinatorArg[]> = Parser<
  OrValues<P>,
  OrNames<P>
>;

type OrValues<P extends CombinatorArg[]> = ParserResultFromArg<P[number]>;
type OrNames<P extends CombinatorArg[]> = ParserNamesFromArg<P[number]>;
