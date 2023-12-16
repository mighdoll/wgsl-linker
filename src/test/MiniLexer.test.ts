import { expect, test } from "vitest";
import { lex } from "../MiniLexer";
import { tokenMatcher } from "../TokenMatcher.js";
import { miniParse } from "../MiniParser.js";

test("lex #import foo", () => {
  const lexer = lex(`#import foo`);
  const tokens = [1, 2].map(lexer.next);
  expect(tokens.map((t) => t?.kind)).toEqual(["directive", "word"]);
});

test.only("parse #import foo", () => {
  const parsed = miniParse("#import foo");
  console.log("parsed result:", parsed);
});

test("/* foo */", () => {
  const lexer = lex(`/* foo */`);
  const tokens = [1, 2, 3].map(lexer.next);
  const tokenKinds = tokens.map((t) => t?.kind);
  expect(tokenKinds).toEqual(["commentStart", "word", "commentEnd"]);
});

test("token matcher", () => {
  const m = tokenMatcher({
    name: /[a-z]+/,
    spaces: /\s+/,
    number: /\d+/,
  });
  m.start("27 foo");
  const [a, b, c] = [1, 2, 3].map(m.next);
  expect(a).toEqual({ kind: "number", text: "27" });
  expect(b).toEqual({ kind: "spaces", text: " " });
  expect(c).toEqual({ kind: "name", text: "foo" });
});
