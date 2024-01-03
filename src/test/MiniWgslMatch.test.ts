import { expect, test } from "vitest";
import { matchingLexer } from "../MatchingLexer.js";
import { mainTokens } from "../MiniWgslMatch.js";

test("lex #import foo", () => {
  const lexer = matchingLexer(`#import foo`, mainTokens);
  const tokens = [1, 2].map(lexer.next);
  expect(tokens.map((t) => t?.kind)).toEqual(["importD", "word"]);
});

test("/* foo */", () => {
  const lexer = matchingLexer(`/* foo */`, mainTokens);
  const tokens = [1, 2, 3].map(lexer.next);
  const tokenKinds = tokens.map((t) => t?.kind);
  expect(tokenKinds).toEqual(["symbol", "word", "symbol"]);
});
