import { expect, test } from "vitest";
import { matchingLexer } from "../MatchingLexer.js";
import { directiveArgsTokens, mainTokens } from "../MiniWgslMatch.js";
import {
  ParserStage,
  fn,
  kind,
  not,
  opt,
  or,
  repeat,
  seq,
} from "../ParserCombinator.js";
import { _withBaseLogger, enableTracing } from "../ParserTracing.js";
import { Token } from "../TokenMatcher.js";
import { logCatch } from "./LogCatcher.js";
import { testParse } from "./TestParse.js";

const m = mainTokens;

test("or() finds first match", () => {
  const src = "#import";
  const p = or("importD", "lineComment");
  const { parsed, position } = testParse(p, src);
  expect(parsed?.value).toEqual("#import");
  expect(position).toEqual(src.length);
});

test("or() finds second match", () => {
  const src = "// #import";
  const p = or(m.importD, m.lineComment);
  const { parsed, position } = testParse(p, src);
  expect(parsed?.value).toEqual("//");
  expect(position).toEqual("//".length);
});

test("or() finds no match ", () => {
  const src = "fn decl() {}";
  const p = or(m.importD, m.lineComment);
  const { parsed, position } = testParse(p, src);
  expect(parsed).toEqual(null);
  expect(position).toEqual(0);
});

test("seq() returns null with partial match", () => {
  const src = "#import";
  const p = seq("directive", "word");
  const { parsed, position } = testParse(p, src);
  expect(parsed).toEqual(null);
  expect(position).toEqual(0);
});

test("seq() handles two element match", () => {
  const src = "#import foo";
  const p = seq(m.importD, m.word);
  const { parsed } = testParse(p, src);
  expect(parsed).toMatchSnapshot();
});

test("named kind match", () => {
  const src = "foo";
  const p = kind(m.word).named("nn");
  const { parsed } = testParse(p, src);
  expect(parsed?.named.nn).deep.equals(["foo"]);
});

test("seq() with named result", () => {
  const src = "#import foo";
  const p = seq(m.importD, kind(m.word).named("yo"));
  const { parsed } = testParse(p, src);
  expect(parsed?.named.yo).deep.equals(["foo"]);
});

test("opt() makes failing match ok", () => {
  const src = "foo";
  const p = seq(opt("directive"), "word");
  const { parsed } = testParse(p, src);
  expect(parsed).not.null;
  expect(parsed).toMatchSnapshot();
});

test("repeat() to (1,2,3,4) via named", () => {
  const src = "(1,2,3,4)";
  const lexer = matchingLexer(src, directiveArgsTokens);
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
  const { parsed } = testParse(p, src);
  expect(parsed?.value).equals("foo!");
});

test("mapResults()", () => {
  const src = "foo";
  const p = kind(m.word)
    .named("word")
    .mapResults((r) => (r.named.word?.[0] === "foo" ? "found" : "missed"));
  const { parsed } = testParse(p, src);
  expect(parsed?.value).equals("found");
});

test("not() success", () => {
  const src = "foo bar";
  const p = repeat(not(m.lbrace));
  const { parsed } = testParse(p, src);

  const values = parsed!.value as Token[];
  expect(values.map((v) => v.text)).deep.equals(["foo", "bar"]);
});

test("not() failure", () => {
  const src = "foo";
  const p = seq(not(m.word));
  const { parsed } = testParse(p, src);
  expect(parsed).null;
});

test("recurse with fn()", () => {
  const src = "{ a { b } }";
  const p: ParserStage<any> = seq(
    m.lbrace,
    repeat(
      or(
        kind(m.word).named("word"),
        fn(() => p)
      )
    ),
    m.rbrace
  );
  const wrap = or(p).mapResults((r) => r.results.push(r.named.word));
  const { app } = testParse(wrap, src);
  expect(app[0]).deep.equals(["a", "b"]);
});

test("tracing", () => {
  const src = "a";
  const { log, logged } = logCatch();
  const p = repeat(seq(m.word).traceName("wordz")).trace();
  enableTracing();
  _withBaseLogger(log, () => {
    testParse(p, src);
  });
  expect(logged()).toMatchSnapshot();
});
