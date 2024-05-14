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

  type Hidden = ThreeParams<any, any, any>;

  function makeThree<A, B, C>(a: A, b: B, c: C): ThreeParams<A, B, C> {
    return { a, b, c };
  }

  function fooB<T extends Hidden>(a: T): InferB<T> {
    return NYI();
  }

  function fooB_simple<B>(a: ThreeParams<any, B, any>): B {
    return NYI();
  }

  function fooB_nope(a: Hidden): InferB<typeof a> {
    return NYI();
  }

  function foo1<A, B, C, D, E, F>(
    a: ThreeParams<A, B, C>,
    b: ThreeParams<D, E, F>
  ): B {
    return NYI();
  }

  function fooM<A, B, C>(args: ThreeParams<any, any, any>[]): any {
    return NYI();
  }

  /** return type is the second type parameter of the first argument */
  function fooH<T extends Hidden>(...args: T[]): InferB<(typeof args)[0]> {
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

  w;

  // const xx = ["foo", "bar"];
  // function ss<P extends CombinatorArg[]> (...args: P): SeqValues<P> {
  //   return null as any;
  // }

  // const yy = ss("foo", "bar", null as unknown as Parser<number, any>);
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

// TODO why does this fail?
test("Recovering Record Key Names with Parser", () => {
  type TagRecord = Record<string | symbol, any>;
  type CombinatorArg =
    | Parser<any, TagRecord>
    | string
    | (() => Parser<any, TagRecord>);
  type SeqParser<P extends CombinatorArg[]> = Parser<SeqValues<P>, SeqTags<P>>;
  type TagsFromArg<A extends CombinatorArg> =
    A extends Parser<any, infer R>
      ? R
      : A extends string
        ? NoTags
        : A extends () => Parser<any, infer R>
          ? R
          : never;
  type SeqTags<P extends CombinatorArg[]> = KeyedRecord<
    Intersection<TagsFromArg<P[number]>>
  >;

  function f<A extends CombinatorArg[]>(...args: A): SeqParser<A> {
    return args as any;
  }

  const x = f(kind("word").tag("X"));
});
