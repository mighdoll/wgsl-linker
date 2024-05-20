import { expect, test } from "vitest";
import { calcTokens, statement } from "../examples/CalculatorExample.js";
import {
  taggedSum,
  simpleSum,
  simpleTokens,
  sumResults
} from "../examples/DocExamples.js";
import { matchingLexer } from "../MatchingLexer.js";
import { Parser } from "../Parser.js";
import { testParse } from "mini-parse/test-util";

test("parse 3 + 4", () => {
  const src = "3 + 4";
  const parsed = testParse(statement, src, calcTokens);
  expect(parsed.position).eq(src.length);
});

test("parse 3 + 4 + 7", () => {
  const src = "3 + 4 + 7";
  const parsed = testParse(statement, src, calcTokens);
  expect(parsed.position).eq(src.length);
});

test("simple sum", () => {
  const lexer = matchingLexer("4 + 8", simpleTokens);
  const results = simpleSum.parse({ lexer });
  expect(results?.value).deep.eq(["4", "+", "8"]);
});

test("simple sum results ", () => {
  const lexer = matchingLexer("3 + 12", simpleTokens);
  const results = sumResults.parse({ lexer });
  expect(results?.value).eq(15);
});

test("tagged sum results ", () => {
  const lexer = matchingLexer("1 + 2 + 9", simpleTokens);
  const results = taggedSum.parse({ lexer });
  expect(results?.value).eq(12);
});



function calcTest(parser: Parser<number>, src: string): number | undefined {
  const { parsed } = testParse(parser, src, calcTokens);
  return parsed?.value;
}
