import { expect, test } from "vitest";
import { matchOneOf, tokenMatcher } from "../TokenMatcher.js";
import { matchingLexer } from "../MatchingLexer.js";
import { kind, opt, seq } from "../ParserCombinator.js";

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

  // parsing and extracint result
  const result = fnDecl.parse({ lexer });

  if (result) {
    const foundIdent = result.value[2];
    expect(foundIdent).toBe("foo");
    console.log(result.value);
  }
  console.log("bah");
  expect(result).toBeDefined();
});

