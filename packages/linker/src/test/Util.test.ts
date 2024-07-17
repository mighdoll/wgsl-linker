import { expect, test } from "vitest";
import { overlapTail, scan } from "../Util.js";

test("scan", () => {
  const result = scan([1, 2, 1], (a, b: string) => b.slice(a), "foobar");
  expect(result).deep.equals(["foobar", "oobar", "bar", "ar"]);
});

test("overlap 0", () => {
  const result = overlapTail([2, 3], [4, 5]);
  expect(result).undefined;
});

test("overlap 1", () => {
  const result = overlapTail([2, 3], [3, 4, 5]);
  expect(result).deep.equals([4, 5]);
});

test("overlap 2", () => {
  const result = overlapTail([2, 3], [2, 3]);
  expect(result).deep.equals([]);
});
