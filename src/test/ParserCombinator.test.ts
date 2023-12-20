import { test, expect } from "vitest";
import { kind, or } from "../ParserCombinator.js";
import { matchingLexer } from "../MatchingLexer.js";
import { mainMatch } from "../MiniLexer.js";

test("or() finds first match", () => {
  const src = "#import";
  const lexer = matchingLexer(src, mainMatch);
  const results: any[] = [];
  const p = or(kind("directive"), kind("lineComment"));
  const lexed = p({ lexer, results });
  expect(lexed).toEqual({ kind: "directive", text: "#import" });
  const position = lexer.position();
  expect(position).toEqual(src.length);
});

test("or() finds second match", () => {
  const src = "// #import";
  const lexer = matchingLexer(src, mainMatch);
  const results: any[] = [];
  const p = or(kind("directive"), kind("lineComment"));
  const lexed = p({ lexer, results });  
  expect(lexed?.kind).toEqual("lineComment");
  const position = lexer.position();
  expect(position).toEqual("//".length);
});
