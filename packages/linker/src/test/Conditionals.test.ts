import { expect, test } from "vitest";
import { processConditionals } from "../Conditionals.js";

test("parse #if #endif", () => {
  const src = `
    #if foo
    fn f() { }
    #endif
    `;

  const result = processConditionals(src, { foo: true });
  expect(result).contains("fn f() { }");
});
