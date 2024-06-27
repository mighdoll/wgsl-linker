import { expect, test } from "vitest";
import { trimIndent } from "../StringUtil.js";

test("trimIndent on blank", () => {
  const trimmed = trimIndent(``);
  expect(trimmed).eq("");
});

test("trimIndent with leading blank lines", () => {
  const trimmed = trimIndent(`

    fn foo() {
      // bar
    }`);
  expect(trimmed).eq("fn foo() {\n  // bar\n}");
});

test("trimIndent with blank line in the middle and at end", () => {
  const trimmed = trimIndent(
    `
      foo

      bar
     `
  );
  expect(trimmed).eq("foo\n\nbar");
});
