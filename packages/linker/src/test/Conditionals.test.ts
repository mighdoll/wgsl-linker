import { expect, test } from "vitest";
import { processConditionals } from "../Conditionals.js";
import { expectNoLogErr } from "mini-parse/test-util";

test("parse #if #endif", () => {
  const src = `
    #if foo
    fn f() { }
    #endif
    `;

  const result = processConditionals(src, { foo: true });
  expect(result).contains("fn f() { }");
});

test("parse // #if !foo", () => {
  const src = `
    // #if !foo
      fn f() { }
    // #endif 
    `;
  const result = processConditionals(src, { foo: false });
  expect(result).contains("fn f() { }");
});

test("parse #if !foo (true)", () => {
  const src = `
    // #if !foo
      fn f() { }
    // #endif 
    `;
  expectNoLogErr(() => {
    const result = processConditionals(src, { foo: true });
    expect(result).eq("\n");
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
  const result = processConditionals(src, { foo: true });
  expect(result).contains("fn g()");
  expect(result).not.contains("fn f()");
});

test.skip("parse nested #if", () => {
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
  expectNoLogErr(() => {
    const result = processConditionals(src, { foo: true, zap: true });
    console.log(result);
    expect(result).contains("fn zap()");
    expect(result).contains("fn g()");
    expect(result).not.contains("fn f()");
  });
});