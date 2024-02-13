import { dlog } from "berry-pretty";
import { expect, test } from "vitest";
import { calcTokens, statement } from "../CalculatorExample.js";
import { testParse } from "./TestParse.js";
import { power, product, statement2, sum } from "../CalculatorResultsExample.js";

test("parse 3 + 4", () => {
  const parsed = testParse(statement, "3 + 4", calcTokens);
  // TODO
  // dlog({ parsed });
});

test("parse 3 + 4 + 7", () => {
  testParse(statement, "3 + 4 + 7", calcTokens);
  // TODO
});

test("power 2 ^ 4", () => {
  const { parsed } = testParse(power, "2 ^ 3", calcTokens);
  expect(parsed?.value).eq(8);
});

test("product 3 * 4 ", () => {
  const { parsed } = testParse(product, "3 * 4", calcTokens);
  expect(parsed?.value).eq(12);
});

test("sum 3 + 4 ", () => {
  const { parsed } = testParse(sum, "3 + 4", calcTokens);
  expect(parsed?.value).eq(7);
});

// test("parse 3 + 4 and return result", () => {
//   const { parsed } = testParse(statement2, "3 + 4", calcToken);

//   dlog({ parsed });
// });
