import { expect, test } from "vitest";
import { matchingLexer } from "../MatchingLexer.js";
import { mainMatch } from "../MiniLexer.js";
import { lineComment, miniParse } from "../MiniParser.js";
import { ParserContext, ParserStage } from "../ParserCombinator.js";

test("parse #import foo", () => {
  const parsed = miniParse("#import foo");
  expect(parsed).toMatchSnapshot();
});

test("parse empty string", () => {
  const parsed = miniParse("");
  expect(parsed).toMatchSnapshot();
});

test("lineComment parse // foo bar", () => {
  const src = "// foo bar";
  const state = testParse(lineComment, src);
  expect(state.lexer.position()).eq(src.length);
});

test("lineComment parse // #import foo", () => {
  const src = "// #import foo";
  const state = testParse(lineComment, src);
  expect(state.lexer.position()).eq(src.length);
  expect(state.results).toMatchSnapshot();
});

export function testParse<T>(
  stage: ParserStage<T>,
  src: string
): ParserContext {
  const lexer = matchingLexer(src, mainMatch);
  const results: any[] = [];

  const state: ParserContext = { lexer, results };
  stage(state);

  return state;
}
