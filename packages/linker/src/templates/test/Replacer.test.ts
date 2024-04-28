import { expectNoLogErr } from "mini-parse/test-util";
import { expect, test } from "vitest";
import { replacer } from "../Replacer.js";

test("parse blank line", () => {
  const src = "";
  const { text } = replacer(src, {});
  expect(text).eq(src);
});

test("parse line w/o replacement", () => {
  const src = "fn main() { // foo";
  const { text } = replacer(src, {});
  expect(text).eq(src);
});

test("parse line w/ single replacement", () => {
  const src = "var a = 4; // #replace 4=workSize";
  const { text } = replacer(src, { workSize: 128 });
  expect(text).includes("var a = 128;");
});

test("parse line w/ multiple replacement", () => {
  const src = "for (var a = 0; a <= 4; a++) { // #replace 0=start 4=end";
  const { text } = replacer(src, { start: 128, end: 255 });
  expect(text).includes("a = 128; a <= 255;");
});

test("parse line w/ quoted replace", () => {
  const src = 'const b; // #replace "const b"=decl';
  const { text } = replacer(src, { decl: "var a" });
  expect(text).includes("var a;");
});

test("multiline blank", () => {
  const src = ` 
  `;
  expectNoLogErr(() => {
    replacer(src, {});
  });
});

test("internal spacing preserved", () => {
  const src = ` 
  ;`;
  const { text } = replacer(src, {});
  expect(text).eq(src);
});

test("parse line w/ single replacement and following blank line", () => {
  const src = `var a = 4; // #replace 4=workSize

  ;
  `;
  const expected = `var a = 128;

  ;
  `;
  const { text } = replacer(src, { workSize: 128 });
  expect(text).eq(expected);
});
