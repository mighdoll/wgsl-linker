import { TagRecord, NoTags, Parser } from "./Parser.js";

/** Typescript types for parser combinators */

/** Intersection of types.
 * @param U is normally a union type, e.g. A | B | C
 * @return type intersection version of U, e.g. A & B & C
 *
 * Works by placing U into contraviant position, and then inferring its type.
 * See https://www.typescriptlang.org/docs/handbook/advanced-types.html#type-inference-in-conditional-types
 * and https://stackoverflow.com/questions/50374908/transform-union-type-to-intersection-type
 * 
 * (and wrapping things in conditional types with ? : never gives us a stage to place the inferencing)
 */
export type Intersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I
) => void
  ? I
  : never;

/**
 * Define keys explictly for a Record type.
 * Sometimes TypeScript is tempted to return a generic Record
 * rather than specific keys for a Record.
 *
 * e.g. the type {a: number, b: string} could be also be Record<string, number|string>
 *
 * KeyedRecord will ask Typescript to return help the first version if possible..
 *
 * @param T a Record type
 * @returns a Record type with the keys explictly defined, if possible.
 */
export type KeyedRecord<T> = { [A in keyof T]: T[A] };

/** 
 * This type describes the variations for parser combinator arguments.
 * 
 * Parser combinators seq(), or() and similiar combinators 
 * combine other parsers they take as function arguments. 
 * Standard combinators also accept arguments that are nullary functions
 * returning a parser (for lazy initialization), 
 * or simple string arguments. Strings are later converted to text() parsers.
 */
export type CombinatorArg =
  | Parser<any, TagRecord>
  | string
  | (() => Parser<any, TagRecord>);

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
  ResultFromArg<A>,
  TagsFromArg<A>
>;

/** 
 * @return Parser corresponding to an array that repeats the same CombinatorArg. 
 */ 
export type ParserFromRepeatArg<A extends CombinatorArg> = Parser<
  ResultFromArg<A>[],
  TagsFromArg<A>
>;

/** Result value type returned by a parser specified by a CombinatorArg */
export type ResultFromArg<A extends CombinatorArg> =
  A extends Parser<infer R, any>
    ? R
    : A extends string
      ? string
      : A extends () => Parser<infer R, any>
        ? R
        : never;

/** parser NameRecord returned by parser specified by a CombinatorArg */
export type TagsFromArg<A extends CombinatorArg> =
  A extends Parser<any, infer R>
    ? R
    : A extends string
      ? NoTags
      : A extends () => Parser<any, infer R>
        ? R
        : never;


/** Parser type returned by seq(), 
 *    concatenates the argument result types into an array
 *    and intersects the argument name records into a single keyed record.
 * @param P type of arguments to seq()
 */
export type SeqParser<P extends CombinatorArg[]> = Parser<
  SeqValues<P>,
  SeqTags<P>
>;

/**
 * The type of an array of parsed result values from an array of parsers specified
 * by CombinatorArgs.
 * 
 * Note that although looks like an object type given the {} syntax, it's not. 
 * As of TS 4.1, type mapping over keys of an array or tuple returns an array or tuple type, not an object type.
 */
export type SeqValues<P extends CombinatorArg[]> = {
  [key in keyof P]: ResultFromArg<P[key]>;
};

type SeqTags<P extends CombinatorArg[]> = KeyedRecord<
  Intersection<TagsFromArg<P[number]>>
>;

export type OrParser<P extends CombinatorArg[]> = Parser<
  OrValues<P>,
  OrNames<P>
>;

type OrValues<P extends CombinatorArg[]> = ResultFromArg<P[number]>;
type OrNames<P extends CombinatorArg[]> = TagsFromArg<P[number]>;


// First Type param V to Combo:
//    { [key in keyof Ts]: ExtractValue<Ts[key]> },
//  This looks like an object type given the {} syntax. But it's not. As of TS 3.1,
//  type mapping over keys of an array or tuple returns an array or tuple type, not an object type.
//  Here's how it works:
//
//  [key in keyof Ts] is the indices of of Ts:
//     0, 1, ...
//  Ts[key] gets us the type of index corresponding Combo arg
//     Ts[0] is Combo<number, {A:number}>
//  ExtractValue gets just the first type parameter out of Combo
//     ExtractValue<Ts[0]> is number
//  So the resulting type mapping looks like this:
//    {0:number, 1:string, ...}
//  And because Ts is an array or tuple, Typescript interprets that as what we want:
//    [number, string]
//
// Second type param N to Combo
//    UnionToIntersection<ExtractObject<Ts[number]>>
//
//  Ts[number] is the type of the provided Combo arguments:
//      Combo<number, {A:number}>, Combo<string, B:string>, ...
//  Because this is covariant, ts combines the args into into a union:
//      Combo<number, {A:number}> | Combo<string, B:string> | ...
//  ExtractObject gets us the union of just the second combo type parameter
//      {A:number} | {B:string} | ...
//  UnionToIntersection converts the union to interexection
//      {A:number} & {B:string} & ...
//  which is equivalent to what we want:
//      {A:number, B:string, ...}