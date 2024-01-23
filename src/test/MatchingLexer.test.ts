import { expect, test } from "vitest";
import { matchingLexer } from "../MatchingLexer.js";
import { tokenMatcher } from "../TokenMatcher.js";

const simpleTokens = tokenMatcher({
  word: /\w+/,
  ws: /\s+/,
});

test("containing line", () => {
  const src = `1
    line2
    line3
  `;
  const lexer = matchingLexer(src, simpleTokens);

  const line0 = lexer.lineAt(0);
  expect(line0).equals("1");

  const line2 = lexer.lineAt(5);
  expect(line2).contains("line2");

  // verify overshoot is ok
  const line3 = lexer.lineAt(100);
  expect(line3).contains("line3");
});
