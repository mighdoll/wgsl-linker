import { expect, test } from "vitest";
import { matchingLexer } from "../MatchingLexer.js";
import { mainMatch } from "../MiniLexer.js";
import { directive, lineComment, miniParse } from "../MiniParser.js";
import { ParserContext, ParserStage } from "../ParserCombinator.js";

test("parse empty string", () => {
  const parsed = miniParse("");
  expect(parsed).toMatchSnapshot();
});

test("directive parses #export", () => {
  const parsed = testParse(directive, "#export");
  expect(parsed.app[0].kind).equals("export");
});

test("parse #export", () => {
  const parsed = miniParse("#export");
  expect(parsed[0].kind).equals("export");
});

test("parse #export foo", () => {
  const parsed = miniParse("#export foo");
  expect(parsed).toMatchSnapshot();
});

test("parse #export foo(bar)", () => {
  const parsed = miniParse("#export foo(bar)");
  expect(parsed).toMatchSnapshot();
});

test("parse #export foo(bar, baz, boo)", () => {
  const parsed = miniParse("#export foo(bar, baz, boo)");
  expect(parsed).toMatchSnapshot();
});

test("parse #import foo", () => {
  const parsed = miniParse("#import foo");
  expect(parsed).toMatchSnapshot();
});

test("parse #import foo(a,b) from bar as baz", () => {
  const parsed = miniParse("#import foo from bar as baz");
  expect(parsed).toMatchSnapshot();
});

test("lineComment parse // foo bar", () => {
  const src = "// foo bar";
  const state = testParse(lineComment, src);
  expect(state.lexer.position()).eq(src.length);
});

test("lineComment parse // #export foo", () => {
  const src = "// #export foo";
  const state = testParse(lineComment, src);
  expect(state.lexer.position()).eq(src.length);
  expect(state.app).toMatchSnapshot();
});

test("parse fn foo() {}", () => {
  const src = "fn foo() { }";
  const parsed = miniParse(src);
  expect(parsed).toMatchSnapshot();
});

export function testParse<T>(
  stage: ParserStage<T>,
  src: string
): ParserContext {
  const lexer = matchingLexer(src, mainMatch);
  const app: any[] = [];

  const state: ParserContext = { lexer, app };
  stage(state);

  return state;
}
