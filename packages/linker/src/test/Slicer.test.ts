import { expect, test } from "vitest";
import { sliceReplace } from "../Slicer.js";

test("slice middle", () => {
  const src = "aaabbbc";
  const result = sliceReplace(src, [{ start: 3, end: 6, replacement: "X" }]);
  expect(result).eq("aaaXc");
});

test("slice end", () => {
  const src = "aaabbb";
  const result = sliceReplace(src, [{ start: 3, end: 6, replacement: "X" }]);
  expect(result).eq("aaaX");
});

test("slice beginning", () => {
  const src = "aaabbb";
  const result = sliceReplace(src, [{ start: 0, end: 3, replacement: "X" }]);
  expect(result).eq("Xbbb");
});

test("slice multiple", () => {
  const src = "aaabbbc";
  const result = sliceReplace(src, [
    { start: 3, end: 6, replacement: "B" },
    { start: 0, end: 3, replacement: "A" }
  ]);
  expect(result).eq("ABc");
});

test("slice none", () => {
  const src = "aaabbbc";
  const result = sliceReplace(src, []);
  expect(result).eq(src);
});

test("slice none with start and end", () => {
  const src = "aaabbbc";
  const result = sliceReplace(src, [], 3, 6);
  expect(result).eq("bbb");
});

test("slice one with start and end", () => {
  const src = "aaabbbc";

  const slices = [{ start: 3, end: 6, replacement: "B" }];
  const result = sliceReplace(src, slices, 2);
  expect(result).eq("aBc");
});
