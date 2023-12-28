import { expect, test } from "vitest";
import { matchingLexer } from "../MatchingLexer.js";
import { mainMatch } from "../MiniWgslMatch.js";
import { directive, lineComment, miniParse } from "../MiniWgslParse.js";
import { ParserContext, ParserStage } from "../ParserCombinator.js";
import { testParse } from "./TestParse.js";

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
  const { position } = testParse(lineComment, src);
  expect(position).eq(src.length);
});

test("lineComment parse // #export foo", () => {
  const src = "// #export foo";
  const { position, app } = testParse(lineComment, src);
  expect(position).eq(src.length);
  expect(app).toMatchSnapshot();
});

test("parse fn foo() { }", () => {
  const src = "fn foo() { }";
  const parsed = miniParse(src);
  expect(parsed).toMatchSnapshot();
});

test("parse fn with calls", () => {
  const src = "fn foo() {  foo(); bar(); }";
  const parsed = miniParse(src);
  expect(parsed).toMatchSnapshot();
});
