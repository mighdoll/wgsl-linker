import { expect, test } from "vitest";
import { directive, lineComment, parseMiniWgsl } from "../ParseWgslD.js";
import { testParse } from "./TestParse.js";

// import { enableTracing } from "../ParserTracing.js";
// enableTracing();

test("parse empty string", () => {
  const parsed = parseMiniWgsl("");
  expect(parsed).toMatchSnapshot();
});

test("directive parses #export", () => {
  const parsed = testParse(directive, "#export");
  expect(parsed.app[0].kind).equals("export");
});

test("parse #export", () => {
  const parsed = parseMiniWgsl("#export");
  expect(parsed[0].kind).equals("export");
});

test("parse #export foo", () => {
  const parsed = parseMiniWgsl("#export foo");
  expect(parsed).toMatchSnapshot();
});

test("parse #export foo(bar)", () => {
  const parsed = parseMiniWgsl("#export foo(bar)");
  expect(parsed).toMatchSnapshot();
});

test("parse #export foo(bar, baz, boo)", () => {
  const parsed = parseMiniWgsl("#export foo(bar, baz, boo)");
  expect(parsed).toMatchSnapshot();
});

test("parse #import foo", () => {
  const parsed = parseMiniWgsl("#import foo");
  expect(parsed).toMatchSnapshot();
});

test("parse #import foo(a,b) as baz from bar", () => {
  const parsed = parseMiniWgsl("#import foo as baz from bar");
  expect(parsed).toMatchSnapshot();
});

test("lineComment parse // foo bar", () => {
  const src = "// foo bar";
  const { position } = testParse(lineComment, src);
  expect(position).eq(src.length);
});

test("lineComment parse // foo bar \\n", () => {
  const comment = "// foo bar";
  const src = comment + "\n x";
  const { position } = testParse(lineComment, src);
  expect(position).eq(comment.length);
});

test("lineComment parse // #export foo", () => {
  const src = "// #export foo";
  const { position, app } = testParse(lineComment, src);
  expect(position).eq(src.length);
  expect(app).toMatchSnapshot();
});

test("parse fn foo() { }", () => {
  const src = "fn foo() { }";
  const parsed = parseMiniWgsl(src);
  expect(parsed).toMatchSnapshot();
});

test("parse fn with calls", () => {
  const src = "fn foo() { foo(); bar(); }";
  const parsed = parseMiniWgsl(src);
  expect(parsed).toMatchSnapshot();
});

test("parse struct", () => {
  const src = "struct Foo { a: f32; b: i32; }";
  const parsed = parseMiniWgsl(src);
  expect(parsed).toMatchSnapshot();
});

test("parse fn with line comment", () => {
  const src = `
    fn binaryOp() { // binOpImpl
    }`;
  const parsed = parseMiniWgsl(src);
  expect(parsed).toMatchSnapshot();
});

test("parse #export(foo) with trailing space", () => {
  const src = `
    // #export (Elem) 
    `;
  const parsed = parseMiniWgsl(src);
  expect(parsed).toMatchSnapshot();
});

test("parse #if !foo #else #endif", () => {
  const src = `
    // #if !foo
      fn f() { notfoo(); }
    // #else
      fn f() { foo(); }
    // #endif 
    `;
  const parsed = parseMiniWgsl(src, { foo: true });
  console.log(parsed);
});
