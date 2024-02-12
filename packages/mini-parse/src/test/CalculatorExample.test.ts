import { dlog } from "berry-pretty";
import { test } from "vitest";
import { calcToken, statement, } from "../CalculatorExample.js";
import { testParse } from "./TestParse.js";

test.only("parse 3 + 4", () => {
  const parsed= testParse(statement, "3 + 4", calcToken);
  dlog({ parsed });
});

test("parse 3 + 4 + 7", () => {
  testParse(statement, "3 + 4 + 7", calcToken);
});

// test("parse 3 + 4 and return result", () => {
//   const { parsed } = testParse(statement2, "3 + 4", calcToken);

//   dlog({ parsed });
// });
