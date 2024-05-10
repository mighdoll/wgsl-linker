import { expect, test } from "vitest";
import { calcTokens, statement } from "../examples/CalculatorExample.js";
import {
  power,
  product,
  statement2,
  sum
} from "../examples/CalculatorResultsExample.js";
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

test("power 2 ^ 4", () => {
  const { parsed } = testParse(power, "2 ^ 3", calcTokens);
  expect(parsed?.value).eq(8);
});

test("product 3 * 4 ", () => {
  const { parsed } = testParse(product, "3 * 4", calcTokens);
  expect(parsed?.value).eq(12);
});

test("sum 3 + 4 ", () => {
  const { parsed } = testParse(sum, "3 + 4", calcTokens);
  expect(parsed?.value).eq(7);
});

test("parse 3 + 4 * 8", () => {
  const result = calcTest(statement2, "3 + 4 * 8");
  expect(result).eq(35);
});

test("parse 3 * 4 + 8", () => {
  const result = calcTest(statement2, "3 * 4 + 8");
  expect(result).eq(20);
});

test("parse 3^2 * 4 + 11", () => {
  const result = calcTest(statement2, "3^2 *4 + 11");
  expect(result).eq(47);
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
