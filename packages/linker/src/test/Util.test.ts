import { expect, test } from "vitest";
import { scan } from "../Util.js";

test("scan", () => {
  const result = scan([1, 2, 1], (a, b: string) => b.slice(a), "foobar");
  expect(result).deep.equals(["foobar", "oobar", "bar", "ar"]);
});