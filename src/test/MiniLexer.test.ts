import { expect, test } from "vitest";
import { lex } from "../MiniLexer";

test("lex #import foo", () => {
  const lexer = lex(`#import foo`);
  const tokens = [1, 2].map(lexer.next);
  expect(tokens.map((t) => t?.kind)).toEqual(["directive", "word"]);
});

test("/* foo */", () => {
  const lexer = lex(`/* foo */`);
  const tokens = [1, 2, 3].map(lexer.next);
  const tokenKinds = tokens.map((t) => t?.kind);
  expect(tokenKinds).toEqual(["commentStart", "word", "commentEnd"]);
});