import { expectNoLogErr } from "mini-parse/test-util";
import { expect, test } from "vitest";
import { replacer } from "../Replacer.js";

test("parse blank line", () => {
  const src = "";
  const { dest } = replacer(src, {});
  expect(dest).eq(src);
});

test("parse line w/o replacement", () => {
  const src = "fn main() { // foo";
  const { dest } = replacer(src, {});
  expect(dest).eq(src);
});

test("parse line w/ single replacement", () => {
  const src = "var a = 4; // #replace 4=workSize";
  const { dest } = replacer(src, { workSize: 128 });
  expect(dest).includes("var a = 128;");
});

test("parse line w/ multiple replacement", () => {
  const src = "for (var a = 0; a <= 4; a++) { // #replace 0=start 4=end";
  const { dest } = replacer(src, { start: 128, end: 255 });
  expect(dest).includes("a = 128; a <= 255;");
});

test("parse line w/ quoted replace", () => {
  const src = 'const b; // #replace "const b"=decl';
  const { dest } = replacer(src, { decl: "var a" });
  expect(dest).includes("var a;");
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
  const { dest } = replacer(src, {});
  expect(dest).eq(src);
});

test("parse line w/ single replacement and following blank line", () => {
  const src = `var a = 4; // #replace 4=workSize

  ;
  `;
  const expected = `var a = 128;

  ;
  `;
  const { dest } = replacer(src, { workSize: 128 });
  expect(dest).eq(expected);
});
