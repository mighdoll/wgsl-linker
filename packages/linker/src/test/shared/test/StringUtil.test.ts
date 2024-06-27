import { expect, test } from "vitest";
import { trimSrc } from "../StringUtil.js";

test("trimIndent on blank", () => {
  const trimmed = trimSrc(``);
  expect(trimmed).eq("");
});

test("trimIndent with leading blank lines", () => {
  const trimmed = trimSrc(`

    fn foo() {
      // bar
    }`);
  expect(trimmed).eq("fn foo() {\n  // bar\n}");
});

test("trimIndent with blank line in the middle and at end", () => {
  const trimmed = trimSrc(
    `
      foo

      bar
     `
  );
  expect(trimmed).eq("foo\n\nbar");
});
