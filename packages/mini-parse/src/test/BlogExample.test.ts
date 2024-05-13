import { expect, test } from "vitest";
import { matchOneOf, tokenMatcher } from "../TokenMatcher.js";
import { matchingLexer } from "../MatchingLexer.js";
import { kind, opt, repeat, seq } from "../ParserCombinator.js";

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

function NYI(): any{
  return null as any;
}

test("types example", () => {
  type TBD = any;
  type TagRecord = Record<string, any[]>;

  class TaggedResult<T, N extends TagRecord> {
    constructor(value: T) {}
    tag(name: string): TBD {
      NYI();
    }
    get result(): T {
      return NYI();
    }
    get tags(): N {
      return NYI();
    }
  }

  function seq(...taggedResultsOrString: TBD[]): TaggedResult<TBD, TBD> {
    NYI();
  }

  const a = new TaggedResult(1).tag("A");
  const b = new TaggedResult("bo");
  const s = seq(a, b.tag("B"), "foo");
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

  function fooM<A,B,C>(args: ThreeParams<any, any, any>[]): any {
    return NYI();
  }

  /** return type is the second type parameter of the first argument */
  function fooH<T extends Hidden>(...args: T[]): InferB<typeof args[0]> {
    return NYI();
  }

  const p = makeThree("foo", 1, true);
  const f: number = fooB(p);
  const h = fooB_simple(p); // works too
  const g = fooB_nope(p); // g is of type any, not what we want

  const x = fooH(p)
});
