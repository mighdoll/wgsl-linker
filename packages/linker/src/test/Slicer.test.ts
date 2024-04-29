import { expect, test } from "vitest";
import { sliceReplace2 } from "../Slicer.js";
import { dlog } from "berry-pretty";

test("slice middle", () => {
  const src = "aaabbbc";
  const srcMap = sliceReplace2(src, [{ start: 3, end: 6, replacement: "X" }]);
  const {dest, entries} = srcMap;
  expect(dest).eq("aaaXc");
  dlog({entries});
});

test("slice end", () => {
  const src = "aaabbb";
  const { dest } = sliceReplace2(src, [{ start: 3, end: 6, replacement: "X" }]);
  expect(dest).eq("aaaX");
});

test("slice beginning", () => {
  const src = "aaabbb";
  const { dest } = sliceReplace2(src, [{ start: 0, end: 3, replacement: "X" }]);
  expect(dest).eq("Xbbb");
});

test("slice multiple", () => {
  const src = "aaabbbc";
  const { dest } = sliceReplace2(src, [
    { start: 3, end: 6, replacement: "B" },
    { start: 0, end: 3, replacement: "A" },
  ]);
  expect(dest).eq("ABc");
});

test("slice none", () => {
  const src = "aaabbbc";
  const { dest } = sliceReplace2(src, []);
  expect(dest).eq(src);
});

test("slice none with start and end", () => {
  const src = "aaabbbc";
  const { dest } = sliceReplace2(src, [], 3, 6);
  expect(dest).eq("bbb");
});

test("slice one with start and end", () => {
  const src = "aaabbbc";

  const slices = [{ start: 3, end: 6, replacement: "B" }];
  const { dest } = sliceReplace2(src, slices, 2);
  expect(dest).eq("aBc");
});
