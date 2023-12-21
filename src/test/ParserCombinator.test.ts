import { test, expect } from "vitest";
import { kind, opt, or, repeat, seq } from "../ParserCombinator.js";
import { matchingLexer } from "../MatchingLexer.js";
import { directiveArgsMatch, mainMatch } from "../MiniLexer.js";
import { Token } from "../TokenMatcher.js";

test("or() finds first match", () => {
  const src = "#import";
  const lexer = matchingLexer(src, mainMatch);
  const results: any[] = [];
  const p = or(kind("directive"), kind("lineComment"));
  const lexed = p({ lexer, results });
  expect(lexed).toEqual({ kind: "directive", text: "#import" });
  expect(lexer.position()).toEqual(src.length);
});

test("or() finds second match", () => {
  const src = "// #import";
  const lexer = matchingLexer(src, mainMatch);
  const results: any[] = [];
  const p = or(kind("directive"), kind("lineComment"));
  const lexed = p({ lexer, results });
  expect(lexed?.kind).toEqual("lineComment");
  expect(lexer.position()).toEqual("//".length);
});

test("or() finds no match ", () => {
  const src = "fn decl() {}";
  const lexer = matchingLexer(src, mainMatch);
  const results: any[] = [];
  const p = or(kind("directive"), kind("lineComment"));
  const lexed = p({ lexer, results });
  expect(lexed).toEqual(null);
  expect(lexer.position()).toEqual(0);
});

test("seq() finds partial match", () => {
  const src = "#import";
  const lexer = matchingLexer(src, mainMatch);
  const results: any[] = [];
  const p = seq(kind("directive"), kind("word"));
  const lexed = p({ lexer, results });
  expect(lexed).toEqual(null);
  expect(lexer.position()).toEqual(0);
});

test("opt() makes failing match ok", () => {
  const src = "foo";
  const lexer = matchingLexer(src, mainMatch);
  const results: any[] = [];
  const p = seq(opt(kind("directive")), kind("word"));
  const lexed = p({ lexer, results });
  expect(lexed).not.null;
  expect(lexed).toMatchSnapshot();
});

test("repeat() to (1,2,3,4)", () => {
  const src = "(1,2,3,4)";
  const lexer = matchingLexer(src, directiveArgsMatch);
  const results: any[] = [];
  const wordNum = or(kind("word"), kind("digits"));
  const params = seq(opt(wordNum), opt(repeat(seq(kind("comma"), wordNum))));
  const p = seq(kind("lparen"), params, kind("rparen"));
  const lexed = p({ lexer, results });
  expect(lexed).not.null;
  const first = (lexed![1][0] as Token).text;
  const restList = lexed![1][1] as Token[][];
  const rest = restList.map(([_, x]) => x.text);
  const all = [first, ...rest];
  expect(all).toEqual(["1", "2", "3", "4"]);
});

/*
 wordNum = word | digits
 paramsList = #wordNum? (, #wordNum)*  
 params = "(" paramsList ")"
*/
