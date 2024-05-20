/* eslint-disable @typescript-eslint/no-unused-vars */
import { expect, test } from "vitest";
import { matchOneOf, tokenMatcher } from "../TokenMatcher.js";
import { matchingLexer } from "../MatchingLexer.js";
import { kind, opt, repeat, seq } from "../ParserCombinator.js";
import {
  CombinatorArg,
  Intersection,
  KeyedRecord,
  SeqValues,
} from "../CombinatorTypes.js";
import { NoTags, Parser } from "../Parser.js";
import { as } from "vitest/dist/reporters-P7C2ytIv.js";

test("parse fn foo()", () => {
  const src = "fn foo()";

  // lexer
  const tokens = tokenMatcher({
    ident: /[a-z]+/,
    ws: /\s+/,
    symbol: matchOneOf("( ) [ ] { } @ ; ,"),
  });
  const lexer = matchingLexer(src, tokens);

  // parsers
  const ident = kind(tokens.ident);
  const fnDecl = seq("fn", ident, "(", ")");

  // parsing and extracint result
  const result = fnDecl.parse({ lexer });

  if (result) {
    const foundIdent = result.value[1];
    expect(foundIdent).toBe("foo");
  }
  expect(result).toBeDefined();
});

test("parse fn foo() with annotation in grammar", () => {
  const src = "fn foo()";

  // lexer
  const tokens = tokenMatcher({
    ident: /[a-z]+/,
    ws: /\s+/,
    symbol: matchOneOf("( ) [ ] { } @ ; ,"),
  });
  const lexer = matchingLexer(src, tokens);

  // parsers
  const ident = kind(tokens.ident);
  const annotation = opt(seq("@", ident));
  const fnDecl = seq(annotation, "fn", ident, "(", ")");

  // parsing and extracting result
  const result = fnDecl.parse({ lexer });

  if (result) {
    const fnName = result.value[2];
    expect(fnName).toBe("foo");
  }
  expect(result).toBeDefined();
});

test("parse fn foo() with tagged results", () => {
  const src = "@export fn foo()";

  // lexer
  const tokens = tokenMatcher({
    ident: /[a-z]+/,
    ws: /\s+/,
    symbol: matchOneOf("( ) [ ] { } @ ; ,"),
  });
  const lexer = matchingLexer(src, tokens);

  // parsers
  const ident = kind(tokens.ident);
  const annotation = repeat(seq("@", ident.tag("annotation")));
  const fnDecl = seq(annotation, "fn", ident.tag("fnName"), "(", ")");

  // parsing and extracting result
  const result = fnDecl.parse({ lexer });

  expect(result).toBeDefined();
  if (result) {
    const [fnName] = result.tags.fnName;
    expect(fnName).toBe("foo");
    const annotations: string[] = result.tags.annotation;
    expect(annotations).to.deep.eq(["export"]);
  }
});

function NYI(): any {
  return null as any;
}

test("types example", () => {
  // type TBD = any;
  // type TagRecord = Record<string, any[]>;
  // class TaggedResult<T, N extends TagRecord> {
  //   constructor(value: T) {}
  //   tag(name: string): TBD {
  //     NYI();
  //   }
  //   get result(): T {
  //     return NYI();
  //   }
  //   get tags(): N {
  //     return NYI();
  //   }
  // }
  // // function seq(...taggedResultsOrString: TBD[]): TaggedResult<TBD, TBD> {
  // //   NYI();
  // // }
  // const a = new TaggedResult(1).tag("A");
  // const b = new TaggedResult("bo");
  // const s = seq(a, b.tag("B"), "foo");
});

test("types solution", () => {
  type TagRecord = Record<string, any[]>;
  class Tags<N extends TagRecord> {
    addTag<K extends string, V>(
      name: K,
      value: V
    ): Tags<N & { [key in K]: V[] }> {
      return NYI();
    }
  }

  type CombineArg = string | Tags<any>;
  // function combine(...tags:CombineArg[]):Tags<TBD>
});

test("infer type parameter", () => {
  // prettier-ignore
  interface ThreeParams<A, B, C> { a: A; b: B; c: C; }

  type InferB<T extends ThreeParams<any, any, any>> =
    T extends ThreeParams<any, infer B, any> ? B : never;

  type HiddenThree = ThreeParams<any, any, any>;

  function makeThree<A, B, C>(a: A, b: B, c: C): ThreeParams<A, B, C> {
    return { a, b, c };
  }

  function fooB<T extends HiddenThree>(a: T): InferB<T> {
    return NYI();
  }

  function fooB_simple<B>(a: ThreeParams<any, B, any>): B {
    return NYI();
  }

  function fooB_nope(a: HiddenThree): InferB<typeof a> {
    return NYI();
  }

  function manyParams<A, B, C, D, E, F, G, H, I>(
    a: ThreeParams<A, B, C>,
    b: ThreeParams<D, E, F>,
    c: ThreeParams<G, H, I>
  ): B {
    return NYI();
  }

  function fooM<A, B, C>(args: ThreeParams<any, any, any>[]): any {
    return NYI();
  }

  /** return type is the second type parameter of the first argument */
  function fooH<T extends HiddenThree>(...args: T[]): InferB<(typeof args[0])> {
    return NYI();
  }

  const p = makeThree("foo", 1, true);
  const f: number = fooB(p);
  const h = fooB_simple(p); // works too
  const g = fooB_nope(p); // g is of type any, not what we want

  const x = fooH(p);
});

test("extend a record", () => {
  const a = { a: 1, b: "foo" };
  const b = { ...a, c: true };

  class Tags<N extends Record<string, any>> {
    add<K extends string, V>(name: K, value: V): Tags<N & { [k in K]: V }> {
      name;
      value;
      return {} as any;
    }
    read(): N {
      return NYI();
    }
  }
  const tags = new Tags().add("c", true);
  const moreTags = tags.add("bar", "zap"); // add more fields
  const record: { c: boolean; bar: string } = moreTags.read(); // properly typed result

  b;
  record;
});

test("mapped tuple type", () => {
  type Wrapped<T extends string | number> = T extends string
    ? { str: T }
    : T extends number
      ? { num: T }
      : T;

  // prettier-ignore
  type WrapElems<T extends (string | number)[]> = 
    { [key in keyof T]: Wrapped<T[key]> };

  function wrapEm<T extends (string | number)[]>(...args: T): WrapElems<T> {
    args;
    return NYI();
  }

  const w: [{ num: number }, { str: string }] = wrapEm(1, "foo");
});

// TODO requires recursive type
test("remove type from tuple", () => {
  const a = [1, "foo", true] as const;

  type NotString<T> = T extends string ? never : T;
  type Stringless<T extends any[]> = { [key in keyof T]: NotString<T[key]> };

  function removeStrings<T extends any[]>(...args: T): Stringless<T> {
    args;
    return NYI();
  }

  const b = removeStrings(...a);
});

test("Recovering Record Key Names", () => {
  type Elem = Record<string, any>;
  type MapValues<E extends Elem[]> = { [key in keyof E]: E[key] };

  function f<T extends Elem[]>(...a: T): Intersection<MapValues<T>> {
    return a as any;
  }

  const y = f({ foo: 1 }, { bar: "z" });
});

test("Recovering Record Key Names with Parser", () => {
  //   type TagRecord = Record<string | symbol, any>;
  //   type CombinatorArg =
  //     | Parser<any, TagRecord>
  //     | string
  //     | (() => Parser<any, TagRecord>);
  //   type SeqParser<P extends CombinatorArg[]> = Parser<SeqValues<P>, SeqTags<P>>;
  //   type TagsFromArg<A extends CombinatorArg> =
  //     A extends Parser<any, infer R>
  //       ? R
  //       : A extends string
  //         ? NoTags
  //         : A extends () => Parser<any, infer R>
  //           ? R
  //           : never;
  //   type SeqTags<P extends CombinatorArg[]> = KeyedRecord<
  //     Intersection<TagsFromArg<P[number]>>
  //   >;
  //   type KeyedRecord<T> = { [A in keyof T]: T[A] };
  //   function f<A extends CombinatorArg[]>(...args: A): SeqParser<A> {
  //     return args as any;
  //   }
  //   const x = f(kind("word").tag("X"));
  //   // checking SeqTags component TagsFromArg
  //   type t = TagsFromArg<typeof x>;
  //   type p = Parser<number, t>; // works so far
  //   // checking SeqTags
  //   type st = SeqTags<(typeof x)[]>;
  //   type sp = Parser<number, st>; // still wroks
  //   // checking SeqTags with CombinatorArg[]
  //   type ct = [string, p];
  //   type cs = SeqTags<ct>;
  //   type cp = Parser<[number], cs>; // still works
  //   // hmm..
  //   // decomposing CombinatorArg
  //   // type SeqParser2<P extends Parser<any,any>[]> = Parser<SeqValues<P>, SeqTags<P>>; // still fails
  //   // decomposing SeqTags
  //   type SeqTags2<P extends Parser<any, any>[]> = KeyedRecord<
  //     Intersection<TagsFromArg<P[number]>>
  //   >;
  //   // type SeqParser2<P extends Parser<any,any>[]> = Parser<SeqValues<P>, SeqTags2<P>>; // still fails
  //   // decomposing SeqTags3
  //   type SeqTags3<P extends Parser<any, any>[]> = TagsFromArg<P[0]>;
  //   type SeqParser3<P extends Parser<any, any>[]> = Parser<
  //     SeqValues<P>,
  //     SeqTags3<P>
  //   >; // works
  //   // add back in Intersection, and it fails
  //   type SeqTags4<P extends Parser<any, any>[]> = Intersection<TagsFromArg<P[0]>>;
  //   // type SeqParser4<P extends Parser<any,any>[]> = Parser<SeqValues<P>, SeqTags4<P>>; // fails, unknown type
  //   // but the Intesecting version of SeqTags works in this concrete case:
  //   type st4 = SeqTags4<p[]>;
  //   // slightly smaller verification case, fails as expected
  //   type JustTags<T extends TagRecord> = T;
  //   // type SeqToJustTags<P extends Parser<any, any>[]> = JustTags<SeqTags4<P>>; // fails, unknown type
  //   // still fails even if tags type parameter is specific
  //   // type SeqToJustTags<P extends Parser<any, {b:number[]}>[]> = JustTags<SeqTags4<P>>; // fails, unknown type
  //   // focusing in on Intersection
  //   type Int0<P extends { b: number[] }> = JustTags<P>; // works
  //   // type Int1<P extends {b:number[]}> = JustTags<Intersection<P>> // fails
  //   type Int3 = JustTags<Intersection<{ b: number[] }>>; // works
  //   type Int4 = JustTags<Intersection<{ b: number[] } | { c: string[] }>>; // works
  //   // simplifying TagRecord
  //   type JustTags2<T extends Record<string, any[]>> = T;
  //   type Int5<P extends { b: number[] }> = JustTags2<P>; // works
  //   // type Int6<P extends {b:number[]}> = JustTags2<Intersection<P>> // fails
  //   // breaking down Intersection
  //   type StringRecord = Record<string, any[]>;
  //   type Intersection2<U extends StringRecord> = (
  //     U extends any ? (k: U) => void : never
  //   ) extends (k: infer I) => void
  //     ? I
  //     : never;
  //   // type Int7<P extends {b:number[]}> = JustTags2<Intersection2<P>> // fails
  //   // confirming that it's the 'infer I' step that returns unknown
  //   type JustTags3<T extends Record<string, number[]>> = T;
  //   type Intersection3<U extends StringRecord> = (
  //     U extends any ? (k: U) => void : never
  //   ) extends (i: infer I) => void
  //     ? boolean
  //     : never;
  //   // type Int7<P extends {b:number[]}> = JustTags3<Intersection3<P>> // fails, boolean
  //   // works if we force the infer step
  //   type Intersection4<U extends StringRecord> = (
  //     U extends any ? (k: U) => void : never
  //   ) extends (i: infer I) => void
  //     ? { n: number[] }
  //     : never;
  //   type Int8<P extends { b: number[] }> = JustTags3<Intersection4<P>>; // works
  //   // still fails even if U is forced to extend the right type
  //   type Intersection5<U extends StringRecord> = (
  //     U extends Record<string, number[]> ? (k: U) => void : never
  //   ) extends (i: infer I) => void
  //     ? I
  //     : never;
  //   // type Int9<P extends {b:number[]}> = JustTags3<Intersection5<P>> // fails
  //   // still fails even if we force the k and U
  //   type Intersection6<U extends StringRecord> = (
  //     U extends Record<string, number[]>
  //       ? (k: Record<string, number[]>) => void
  //       : never
  //   ) extends (k: infer I) => void
  //     ? I
  //     : never;
  //   // type Int9<P extends {b:number[]}> = JustTags3<Intersection6<P>> // fails
  //   // force record into the exactly the right shape. works but that's not too surprising.
  //   type TargetRecord<A> = { [K in keyof A]: number[] };
  //   type Int9<P extends { b: number[] }> = JustTags3<
  //     TargetRecord<Intersection6<P>>
  //   >; // works
  //   // does Intersection works w/o array types? nope. wat? time for lunch
  //   type JustTags4<T extends Record<string, any>> = T;
  //   type Intersection7<U> = (U extends any ? (k: U) => void : never) extends (
  //     k: infer I
  //   ) => void
  //     ? I
  //     : never;
  //   // type Int10<P extends Record<string, any>> = JustTags4<Intersection7<P>> ; // fails
  //   // how 'bout if we do the cast trick? yep, works.
  //   type Int11<P extends Record<string, any>> = JustTags4<
  //     KeyedRecord<Intersection7<P>>
  //   >; // works
  //   type T11 = Int11<{ a: number } | { b: string }>; // works
  //   // Why does it Intersection fail? And how does KeyedRecord turn unknown until
  //   // and can we get the cast trick to work for the Record with array values case?
  //   // type B = Int10<infer P> extends unknown ? P : never; // fails
  //   // type F<P extends {a: number}> = JustTags4<P>; // works
  //   // type FO<P extends ({a:true}|{b:false})> = P extends {a:true} ? true : false;
  //   // type Int12 = ({a:true}|{b:false}) extends Record<string, any> ? true : false; // true
  //   // type Int13 = Intersection<{a:true}&unknown>
  //   // type Int14 = FO<{a:true}|{b:false}>
  // });
  // test("recovering record keys as array", () => {
  //   type Verify<T extends Record<string | number | symbol, any[]>> = T;
  //   type Intersection1<U> = (U extends any ? (k: U) => void : never) extends (
  //     k: infer I
  //   ) => void
  //     ? I
  //     : never;
  //   type AsRecord1<T> = { [A in keyof T]: T[A] };
  //   // fails:  Type 'Intersection1<P>[string]' is not assignable to type 'any[]'.ts(2344)
  //   // type Int1<P extends Record<string, any[]>> = Verify<AsRecord1<Intersection1<P>>>;
  //   // type T1 = Int1<{a: ["foo"]}>; // T1 is correct tho
  //   // try updating Intersection to extend Records with arrays
  //   type Intersection2<U extends Record<string, any[]>> = (
  //     U extends any ? (k: U) => void : never
  //   ) extends (k: infer I) => void
  //     ? I
  //     : never;
  //   // no dice
  //   // type Int2<P extends Record<string, any[]>> = Verify<AsRecord1<Intersection2<P>> >;
  //   // try making AsRecord accept an array
  //   type AsRecord2<T extends Record<string, any[]>> = { [A in keyof T]: T[A] };
  //   // fails, If Intersection doesn't produce a Record<string, any[]> we can't pass it to AsRecord2
  //   // type Int2<P extends Record<string, any[]>> = Verify<AsRecord2<Intersection2<P>> >;
  //   // try making AsRecord convert to an array, works!
  //   type AsRecord3<T> =
  //     T extends Record<string, any[]> ? { [A in keyof T]: T[A] } : never;
  //   type Int3<P extends Record<string, any[]>> = Verify<
  //     AsRecord3<Intersection2<P>>
  //   >; // works
  //   type T3 = Int3<{ a: ["foo"] } | { b: [7] }>; // T3 works
});

test("trying again on Parser with array valued tags", () => {
  type TagRecord = Record<string, any[]>;
  type Verify<T extends Record<string | number | symbol, any[]>> = T;
  type CombinatorArg = Parser<any, TagRecord>;
  type AsRecordArray1<T> = { [A in keyof T]: T[A] };

  type TagsFromArg1<A extends CombinatorArg> =
    A extends Parser<any, infer R> ? R : never;

  type SeqTags1<P extends CombinatorArg[]> = AsRecordArray1<
    Intersection<TagsFromArg1<P[number]>>
  >;

  type KeyedRecord<T> = { [A in keyof T]: T[A] };
  // Fails, in somewhat simplified case
  // type V1<P extends CombinatorArg[]> = Verify<SeqTags1<P>>;
});

test("test intersection", () => {
  type ARecord = Record<any, any>;
  type Verify<T extends ARecord> = T; // will fail to typecheck if T is not a Record

  type SimpleIntersection<A extends ARecord, B extends ARecord> = Verify<A & B>;
  type ConcreteIntersect = Verify<Intersection<{ a: 1 } | { b: 2 }>>;
  // type ParamIntersect<A extends ARecord> = Verify<Intersection<A>>; // fails to typecheck

  type AsRecord<T> = T extends Record<any,any> ? { [A in keyof T]: T[A] } : never;
  type ParamIntersect2<A extends ARecord> = Verify<AsRecord<Intersection<A>>>;

  type Test1 = ParamIntersect2<{ a: 1 } | { b: 2 }>; // type Test1 = { a: 1; b: 2; }
});

test("intersecting", () => {
  // prettier-ignore
  type Intersection<U> = 
    (U extends any ? 
      (k: U) => void : never) extends 
      (k: infer I) => void ? 
    I : never;
});
