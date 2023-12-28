import { expect, test } from "vitest";
import { matchingLexer } from "../MatchingLexer.js";
import { mainMatch } from "../MiniWgslMatch.js";

test("lex #import foo", () => {
  const lexer = matchingLexer(`#import foo`, mainMatch);
  const tokens = [1, 2].map(lexer.next);
  expect(tokens.map((t) => t?.kind)).toEqual(["importD", "word"]);
});

test("/* foo */", () => {
  const lexer = matchingLexer(`/* foo */`, mainMatch);
  const tokens = [1, 2, 3].map(lexer.next);
  const tokenKinds = tokens.map((t) => t?.kind);
  expect(tokenKinds).toEqual(["commentStart", "word", "commentEnd"]);
});
