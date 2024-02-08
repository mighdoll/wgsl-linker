import { expect, test } from "vitest";
import { mainTokens } from "../MatchWgslD.js";
import { Parser } from "../../packages/mini-parse/src/Parser.js";
import {
  any,
  anyNot,
  fn,
  kind,
  not,
  opt,
  or,
  repeat,
  repeatWhile,
  req,
  seq,
  text
} from "../../packages/mini-parse/src/ParserCombinator.js";
import { enableTracing, _withBaseLogger } from "../ParserTracing.js";
import { logCatch } from "./LogCatcher.js";
import { testParse } from "./TestParse.js";

const m = mainTokens;

test("or() finds first match", () => {
  const src = "#import";
  const p = or("#import", "//");
  const { parsed, position } = testParse(p, src);
  expect(parsed?.value).toEqual("#import");
  expect(position).toEqual(src.length);
});

test("or() finds second match", () => {
  const src = "// #import";
  const p = or("#import", "//");
  const { parsed, position } = testParse(p, src);
  expect(parsed?.value).toEqual("//");
  expect(position).toEqual("//".length);
});

test("or() finds no match ", () => {
  const src = "fn decl() {}";
  const p = or("#import", "//");
  const { parsed, position } = testParse(p, src);
  expect(parsed).toEqual(null);
  expect(position).toEqual(0);
});

test("seq() returns null with partial match", () => {
  const src = "#import";
  const p = seq("#import", kind("word"));
  const { parsed, position } = testParse(p, src);
  expect(parsed).toEqual(null);
  expect(position).toEqual(0);
});

test("seq() handles two element match", () => {
  const src = "#import foo";
  const p = seq("#import", kind(m.word));
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
  const p = seq("#import", kind(m.word).named("yo"));
  const { parsed } = testParse(p, src);
  expect(parsed?.named.yo).deep.equals(["foo"]);
});

test("opt() makes failing match ok", () => {
  const src = "foo";
  const p = seq(opt("#import"), kind("word"));
  const { parsed } = testParse(p, src);
  expect(parsed).not.null;
  expect(parsed).toMatchSnapshot();
});

test("repeat() to (1,2,3,4) via named", () => {
  const src = "(1,2,3,4)";
  const wordNum = or(kind("word"), kind("digits")).named("wn");
  const params = seq(opt(wordNum), opt(repeat(seq(",", wordNum))));
  const p = seq("(", params, ")");
  const { parsed } = testParse(p, src);
  expect(parsed).not.null;
  expect(parsed?.named.wn).deep.equals(["1", "2", "3", "4"]);
});

test("map()", () => {
  const src = "foo";
  const p = kind(m.word)
    .named("word")
    .map((r) => (r.named.word?.[0] === "foo" ? "found" : "missed"));
  const { parsed } = testParse(p, src);
  expect(parsed?.value).equals("found");
});

test("toParser()", () => {
  const src = "foo !";
  const bang = text("!").named("bang");
  const p = kind("word")
    .named("word")
    .toParser(() => bang);
  const { parsed } = testParse(p, src);
  expect(parsed?.named.bang).deep.equals(["!"]);
});

test("not() success", () => {
  const src = "foo bar";
  const p = repeat(seq(not("{"), any()));
  const { parsed } = testParse(p, src);

  const values = parsed!.value;
  expect(values).toMatchSnapshot();
});

test("not() failure", () => {
  const src = "foo";
  const p = not(kind(m.word));
  const { parsed } = testParse(p, src);
  expect(parsed).null;
});

test("recurse with fn()", () => {
  const src = "{ a { b } }";
  const p: Parser<any> = seq(
    "{",
    repeat(
      or(
        kind(m.word).named("word"),
        fn(() => p)
      )
    ),
    "}"
  );
  const wrap = or(p).map((r) => r.app.state.push(r.named.word));
  const { appState: app } = testParse(wrap, src);
  expect(app[0]).deep.equals(["a", "b"]);
});

test("tracing", () => {
  const src = "a";
  const { log, logged } = logCatch();
  const p = repeat(seq(kind(m.word)).traceName("wordz")).trace();

  enableTracing();
  _withBaseLogger(log, () => {
    testParse(p, src);
  });
  expect(logged()).toMatchSnapshot();
});

test("infinite loop detection", () => {
  const p = repeat(not("x"));
  const { log, logged } = logCatch();

  _withBaseLogger(log, () => {
    testParse(p, "y");
  });

  expect(logged()).includes("infinite");
});

test("preparse simple comment", () => {
  // prettier-ignore
  const pre = seq(
    "/*", 
    repeat(anyNot("*/")), 
    "*/"
  ).traceName("pre");
  const p = repeat(kind(m.word)).preParse(pre);
  const src = "boo /* bar */ baz";

  const { parsed } = testParse(p, src);
  expect(parsed?.value).deep.eq(["boo", "baz"]);
});

test("disable preParse inside quote", () => {
  // prettier-ignore
  const comment = seq(
    "/*", 
    repeat(anyNot("*/")), 
    "*/"
  ).traceName("comment");

  // prettier-ignore
  const quote = seq(
      opt(kind(m.ws)),
      "^", 
      repeat(anyNot("^").named("contents")), 
      "^"
    )
    .map((r) => r.named.contents.map((tok) => tok.text).join(""))
    .disablePreParse()
    .tokenIgnore() // disable ws skipping
    .traceName("quote");

  const p = repeat(or(kind(m.word), quote)).preParse(comment);
  const src = "zug ^zip /* boo */^ zax";

  const { parsed } = testParse(p, src);
  expect(parsed?.value).deep.eq(["zug", "zip /* boo */", "zax"]);
});

test("tokenIgnore", () => {
  const p = repeat(any()).map((r) => r.value.map((tok) => tok.text));
  const src = "a b";
  const { parsed: parsedNoSpace } = testParse(p, src);
  expect(parsedNoSpace?.value).deep.eq(["a", "b"]);

  const { parsed } = testParse(p.tokenIgnore(), src);
  expect(parsed?.value).deep.eq(["a", " ", "b"]);
});

test("token start is after ignored ws", () => {
  const src = " a";
  const p = kind(m.word).map((r) => r.start);
  const { parsed } = testParse(p, src);
  expect(parsed?.value).eq(1);
});

test("req logs a message on failure", () => {
  const src = "a 1;";
  const p = seq("a", req("b"));
  const { log, logged } = logCatch();

  _withBaseLogger(log, () => {
    testParse(p, src);
  });
  expect(logged()).toMatchInlineSnapshot(`
    "expected text 'b''
    a 1;   Ln 1
     ^"
  `);
});

test("repeatWhile", () => {
  let count = 0;
  const p = repeatWhile("a", () => count++ < 2);
  const src = "a a a a";
  const { parsed } = testParse(p, src);
  expect(parsed?.value).deep.eq(["a", "a"]);
});
