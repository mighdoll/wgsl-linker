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
import { directiveArgsMatch, mainMatch } from "../MiniLexer.js";
import { Token } from "../TokenMatcher.js";

const m = mainMatch;

function testCombinator<T>(
  src: string,
  p: ParserStage<T>
): { lexed: OptParserResult<T>; position: number } {
  const lexer = matchingLexer(src, mainMatch);
  const results: any[] = [];
  const lexed = p({ lexer, results });
  return { lexed, position: lexer.position() };
}

test("or() finds first match", () => {
  const src = "#import";
  const p = or("importD", "lineComment");
  const { lexed, position } = testCombinator(src, p);
  expect(lexed?.value).toEqual("#import");
  expect(position).toEqual(src.length);
});

test("or() finds second match", () => {
  const src = "// #import";
  const p = or(m.importD, m.lineComment);
  const { lexed, position } = testCombinator(src, p);
  expect(lexed?.value).toEqual("//");
  expect(position).toEqual("//".length);
});

test("or() finds no match ", () => {
  const src = "fn decl() {}";
  const p = or(m.importD, m.lineComment);
  const { lexed, position } = testCombinator(src, p);
  expect(lexed).toEqual(null);
  expect(position).toEqual(0);
});

test("seq() returns null with partial match", () => {
  const src = "#import";
  const p = seq("directive", "word");
  const { lexed, position } = testCombinator(src, p);
  expect(lexed).toEqual(null);
  expect(position).toEqual(0);
});

test("seq() handles two element match", () => {
  const src = "#import foo";
  const p = seq(m.importD, m.word);
  const { lexed } = testCombinator(src, p);
  expect(lexed).toMatchSnapshot();
});

test("named kind match", () => {
  const src = "foo";
  const p = kind(m.word).named("nn");
  const { lexed } = testCombinator(src, p);
  expect(lexed?.named.nn).deep.equals(["foo"]);
});

test("seq() with named result", () => {
  const src = "#import foo";
  const p = seq(m.importD, kind(m.word).named("yo"));
  const { lexed } = testCombinator(src, p);
  expect(lexed?.named.yo).deep.equals(["foo"]);
});

test("opt() makes failing match ok", () => {
  const src = "foo";
  const p = seq(opt("directive"), "word");
  const { lexed } = testCombinator(src, p);
  expect(lexed).not.null;
  expect(lexed).toMatchSnapshot();
});

test("repeat() to (1,2,3,4) via named", () => {
  const src = "(1,2,3,4)";
  const lexer = matchingLexer(src, directiveArgsMatch);
  const results: any[] = [];
  const wordNum = or("word", "digits").named("wn");
  const params = seq(opt(wordNum), opt(repeat(seq("comma", wordNum))));
  const p = seq("lparen", params, "rparen");
  const lexed = p({ lexer, results });
  expect(lexed).not.null;
  expect(lexed?.named.wn).deep.equals(["1", "2", "3", "4"]);
});

test("map()", () => {
  const src = "foo";
  const p = kind(m.word).map((r) => ({ value: r.value + "!", named: r.named }));
  const { lexed } = testCombinator(src, p);
  expect(lexed?.value).equals("foo!");
});

/*
 consider making a conciser way to specify parsers: 

 wordNum = word | digits
 paramsList = #wordNum? (, #wordNum)*  
 params = "(" paramsList ")"
*/
