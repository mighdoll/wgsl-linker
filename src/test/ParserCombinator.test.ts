import { test, expect } from "vitest";
import { kind, opt, or, repeat, seq } from "../ParserCombinator.js";
import { matchingLexer } from "../MatchingLexer.js";
import { directiveArgsMatch, mainMatch } from "../MiniLexer.js";
import { Token } from "../TokenMatcher.js";

test("or() finds first match", () => {
  const src = "#import";
  const lexer = matchingLexer(src, mainMatch);
  const results: any[] = [];
  const p = or("directive", "lineComment");
  const lexed = p({ lexer, results });
  expect(lexed?.value).toEqual({ kind: "directive", text: "#import" });
  expect(lexer.position()).toEqual(src.length);
});

test("or() finds second match", () => {
  const src = "// #import";
  const lexer = matchingLexer(src, mainMatch);
  const m = mainMatch;
  const results: any[] = [];
  const p = or(m.directive, m.lineComment);
  const lexed = p({ lexer, results });
  expect(lexed?.value.kind).toEqual("lineComment");
  expect(lexer.position()).toEqual("//".length);
});

test("or() finds no match ", () => {
  const src = "fn decl() {}";
  const lexer = matchingLexer(src, mainMatch);
  const results: any[] = [];
  const p = or("directive", "lineComment");
  const lexed = p({ lexer, results });
  expect(lexed).toEqual(null);
  expect(lexer.position()).toEqual(0);
});

test("seq() returns null with partial match", () => {
  const src = "#import";
  const lexer = matchingLexer(src, mainMatch);
  const results: any[] = [];
  const p = seq("directive", "word");
  const lexed = p({ lexer, results });
  expect(lexed).toEqual(null);
  expect(lexer.position()).toEqual(0);
});

test("seq() handles two element match", () => {
  const src = "#import foo";
  const lexer = matchingLexer(src, mainMatch);
  const results: any[] = [];
  const p = seq("directive", "word");
  const lexed = p({ lexer, results });
  expect(lexed).toMatchSnapshot();
});

test("opt() makes failing match ok", () => {
  const src = "foo";
  const lexer = matchingLexer(src, mainMatch);
  const results: any[] = [];
  const p = seq(opt("directive"), "word");
  const lexed = p({ lexer, results });
  expect(lexed).not.null;
  expect(lexed).toMatchSnapshot();
});

// test("repeat() to (1,2,3,4)", () => {
//   const src = "(1,2,3,4)";
//   const lexer = matchingLexer(src, directiveArgsMatch);
//   const results: any[] = [];
//   const wordNum = or("word", "digits");
//   const params = seq(opt(wordNum), opt(repeat(seq("comma", wordNum))));
//   const p = seq("lparen", params, "rparen");
//   const lexed = p({ lexer, results });
//   expect(lexed).not.null;
//   // TODO make extracting results easier to manage
//   const first = (lexed![1][0] as Token).text;
//   const restList = lexed![1][1] as Token[][];
//   const rest = restList.map(([_, x]) => x.text);
//   const all = [first, ...rest];
//   expect(all).toEqual(["1", "2", "3", "4"]);
// });

// test.only("named kind", () => {
//   const src = "foo";
//   const lexer = matchingLexer(src, mainMatch);
//   const results: any[] = [];

//   const p = kind("word").named("a");
//   const lexed = p({ lexer, results });
//   expect(p.result)
//   console.log(lexed);
//   console.log("result:", p.result)
// });

/*
const parse = or("word", "digits").r;
const wordNum = parse("1234");
*/

/*
 consider making a conciser way to specify parsers: 

 wordNum = word | digits
 paramsList = #wordNum? (, #wordNum)*  
 params = "(" paramsList ")"
*/
