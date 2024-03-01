import { _withBaseLogger, srcLog2 } from "mini-parse";
import { expectNoLogErr, logCatch } from "mini-parse/test-util";
import { expect, test } from "vitest";
import { processConditionals } from "../Conditionals.js";
import { dlog } from "berry-pretty";

test("parse #if #endif", () => {
  const src = `
    #if foo
    fn f() { }
    #endif
    `;

  const { text, sourceMap } = processConditionals(src, { foo: true });
  expect(text).contains("fn f() { }");
  expect(sourceMap.entriesMap).toMatchInlineSnapshot(`
    [
      {
        "destEnd": 1,
        "destStart": 0,
        "srcEnd": 1,
        "srcStart": 0,
      },
      {
        "destEnd": 16,
        "destStart": 1,
        "srcEnd": 28,
        "srcStart": 13,
      },
      {
        "destEnd": 20,
        "destStart": 16,
        "srcEnd": 43,
        "srcStart": 39,
      },
    ]
  `);
});

test("parse // #if !foo", () => {
  const src = `
    // #if !foo
      fn f() { }
    // #endif 
    `;
  const { text } = processConditionals(src, { foo: false });
  expect(text).contains("fn f() { }");
});

test("parse #if !foo (true)", () => {
  const src = `
    // #if !foo
      fn f() { }
    // #endif 
    `;
  expectNoLogErr(() => {
    const { text } = processConditionals(src, { foo: true });
    expect(text).not.contains("fn");
    expect(text).not.contains("//");
  });
});

test("parse #if !foo #else #endif", () => {
  const src = `
    // #if !foo
      fn f() { notfoo(); }
    // #else
      fn g() { foo(); }
    // #endif 
    `;
  const { text } = processConditionals(src, { foo: true });
  expect(text).contains("fn g()");
  expect(text).not.contains("fn f()");
});

test("parse nested #if", () => {
  const src = `
    #if foo

    #if bar
      fn f() { }
    #endif

    #if zap
      fn zap() { }
    #endif

      fn g() { }
    #endif 
    `;
  const { text } = processConditionals(src, { foo: true, zap: true });
  expect(text).contains("fn zap()");
  expect(text).contains("fn g()");
  expect(text).not.contains("fn f()");
});

test("parse #if #endif with extra space", () => {
  const src = `
    #if foo 
    fn f() { }
    #endif
    `;

  const { text } = processConditionals(src, {});
  expect(text).not.contains("fn f() { }");
});

test("parse last line", () => {
  const src = `
    #x
    y`;
  const { text } = processConditionals(src, {});
  expect(text).eq(src);
});

test.only("srcLog with srcMap", () => {
  const src = `
  #if !foo
  1234
  #endif`;
  const { sourceMap } = processConditionals(src, {});

  const { log, logged } = logCatch();
  _withBaseLogger(log, () => {
    srcLog2(src, sourceMap, [3, 6], "found:");
  });
  console.log(logged());

  expect(logged()).toMatchInlineSnapshot(`
    "found:
      1234   Ln 3
      ^  ^"
  `);
});
