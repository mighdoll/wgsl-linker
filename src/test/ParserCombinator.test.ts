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
  const p = or("directive", "lineComment");
  const { lexed, position } = testCombinator(src, p);
  expect(lexed?.value).toEqual("#import");
  expect(position).toEqual(src.length);
});

test("or() finds second match", () => {
  const src = "// #import";
  const p = or(m.directive, m.lineComment);
  const { lexed, position } = testCombinator(src, p);
  expect(lexed?.value).toEqual("//");
  expect(position).toEqual("//".length);
});

test("or() finds no match ", () => {
  const src = "fn decl() {}";
  const p = or(m.directive, m.lineComment);
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
  const p = seq(m.directive, m.word);
  const { lexed } = testCombinator(src, p);
  expect(lexed).toMatchSnapshot();
});

test("named kind match", () => {
  const src = "foo";
  const p = kind(m.word).named("nn");
  const { lexed } = testCombinator(src, p);
  expect(lexed?.results.nn).deep.equals(["foo"]);
});

test("seq() with named result", () => {
  const src = "#import foo";
  const p = seq(m.directive, kind(m.word).named("yo"));
  const { lexed } = testCombinator(src, p);
  expect(lexed?.results.yo).deep.equals(["foo"]);
});

// test("seq() with named result", () => {
//   const src = "#import foo";
//   const lexer = matchingLexer(src, mainMatch);
//   const results: any[] = [];
//   const p = seq("directive", kind("word"));
//   const lexed = p({ lexer, results });
//   console.log(lexed);
// });

test("opt() makes failing match ok", () => {
  const src = "foo";
  const p = seq(opt("directive"), "word");
  const { lexed } = testCombinator(src, p);
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
