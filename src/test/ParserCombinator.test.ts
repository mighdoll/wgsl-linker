import { test, expect } from "vitest";
import {
  OptParserResult,
  ParserStage,
  kind,
  opt,
  or,
  repeat,
  seq,
} from "../ParserCombinator.js";
import { matchingLexer } from "../MatchingLexer.js";
import { directiveArgsMatch, mainMatch } from "../MiniWgslMatch.js";
import { Token } from "../TokenMatcher.js";

const m = mainMatch;

function testCombinator<T>(
  src: string,
  p: ParserStage<T>
): { parsed: OptParserResult<T>; position: number } {
  const lexer = matchingLexer(src, mainMatch);
  const app: any[] = [];
  const parsed = p({ lexer, app });
  return { parsed, position: lexer.position() };
}

test("or() finds first match", () => {
  const src = "#import";
  const p = or("importD", "lineComment");
  const { parsed, position } = testCombinator(src, p);
  expect(parsed?.value).toEqual("#import");
  expect(position).toEqual(src.length);
});

test("or() finds second match", () => {
  const src = "// #import";
  const p = or(m.importD, m.lineComment);
  const { parsed, position } = testCombinator(src, p);
  expect(parsed?.value).toEqual("//");
  expect(position).toEqual("//".length);
});

test("or() finds no match ", () => {
  const src = "fn decl() {}";
  const p = or(m.importD, m.lineComment);
  const { parsed, position } = testCombinator(src, p);
  expect(parsed).toEqual(null);
  expect(position).toEqual(0);
});

test("seq() returns null with partial match", () => {
  const src = "#import";
  const p = seq("directive", "word");
  const { parsed, position } = testCombinator(src, p);
  expect(parsed).toEqual(null);
  expect(position).toEqual(0);
});

test("seq() handles two element match", () => {
  const src = "#import foo";
  const p = seq(m.importD, m.word);
  const { parsed } = testCombinator(src, p);
  expect(parsed).toMatchSnapshot();
});

test("named kind match", () => {
  const src = "foo";
  const p = kind(m.word).named("nn");
  const { parsed } = testCombinator(src, p);
  expect(parsed?.named.nn).deep.equals(["foo"]);
});

test("seq() with named result", () => {
  const src = "#import foo";
  const p = seq(m.importD, kind(m.word).named("yo"));
  const { parsed } = testCombinator(src, p);
  expect(parsed?.named.yo).deep.equals(["foo"]);
});

test("opt() makes failing match ok", () => {
  const src = "foo";
  const p = seq(opt("directive"), "word");
  const { parsed } = testCombinator(src, p);
  expect(parsed).not.null;
  expect(parsed).toMatchSnapshot();
});

test("repeat() to (1,2,3,4) via named", () => {
  const src = "(1,2,3,4)";
  const lexer = matchingLexer(src, directiveArgsMatch);
  const app: any[] = [];
  const wordNum = or("word", "digits").named("wn");
  const params = seq(opt(wordNum), opt(repeat(seq("comma", wordNum))));
  const p = seq("lparen", params, "rparen");
  const parsed = p({ lexer, app });
  expect(parsed).not.null;
  expect(parsed?.named.wn).deep.equals(["1", "2", "3", "4"]);
});

test("map()", () => {
  const src = "foo";
  const p = kind(m.word).map((r) => r + "!");
  const { parsed } = testCombinator(src, p);
  expect(parsed?.value).equals("foo!");
});

test("mapResults()", () => {
  const src = "foo";
  const p = kind(m.word)
    .named("word")
    .mapResults((r) => (r.named.word?.[0] === "foo" ? "found" : "missed"));
  const { parsed } = testCombinator(src, p);
  expect(parsed?.value).equals("found");
});

/*
 consider making a conciser way to specify parsers: 

 wordNum = word | digits
 paramsList = #wordNum? (, #wordNum)*  
 params = "(" paramsList ")"
*/
