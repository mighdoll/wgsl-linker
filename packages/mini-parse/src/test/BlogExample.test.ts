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

function NYI(): never {
  throw new Error("NYI");
}

test("types example", () => {
  type TBD = any;
  type TagRecord = Record<string, any[]>;

  class TaggedResult<T, N extends TagRecord> {
    constructor(value:T) { }
    tag(name: string): TBD { NYI(); }
    get result(): T { return NYI(); }
    get tags(): N { return NYI(); }
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
  class TaggedResult<T, N extends TagRecord> {
    tag<K extends string>(name: K): TaggedResult<T, N & { [key in K]: T[] }> {
      NYI();
    }
  }
});
