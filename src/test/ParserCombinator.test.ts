import { test, expect } from "vitest";
import { kind, opt, or, seq } from "../ParserCombinator.js";
import { matchingLexer } from "../MatchingLexer.js";
import { mainMatch } from "../MiniLexer.js";

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
})