import { SrcMap } from "mini-parse";
import { expect, test } from "vitest";
import { sliceReplace2 } from "../Slicer.js";

test("slice middle", () => {
  const src = "aaabbbc";
  const srcMap = sliceReplace2(src, [{ start: 3, end: 6, replacement: "X" }]);
  const { dest, entries } = srcMap;
  expect(dest).eq("aaaXc");
  expect(entries).toMatchInlineSnapshot(`
    [
      {
        "destEnd": 3,
        "destStart": 0,
        "src": "aaabbbc",
        "srcEnd": 6,
        "srcStart": 0,
      },
      {
        "destEnd": 4,
        "destStart": 3,
        "src": "aaabbbc",
        "srcEnd": 6,
        "srcStart": 6,
      },
      {
        "destEnd": 5,
        "destStart": 4,
        "src": "aaabbbc",
        "srcEnd": 7,
        "srcStart": 6,
      },
    ]
  `);
});

test("slice end", () => {
  const src = "aaabbb";
  const srcMap = sliceReplace2(src, [{ start: 3, end: 6, replacement: "X" }]);
  expect(srcMap.dest).eq("aaaX");
  validateDestCovered(srcMap);
});

test("slice beginning", () => {
  const src = "aaabbb";
  const srcMap = sliceReplace2(src, [{ start: 0, end: 3, replacement: "X" }]);
  validateDestCovered(srcMap);
  expect(srcMap.dest).eq("Xbbb");
});

test("slice multiple", () => {
  const src = "aaabbbc";
  const srcMap = sliceReplace2(src, [
    { start: 3, end: 6, replacement: "B" },
    { start: 0, end: 3, replacement: "A" },
  ]);
  validateDestCovered(srcMap);
  expect(srcMap.dest).eq("ABc");
  expect(srcMap.entries).length(3);
});

test("slice none", () => {
  const src = "aaabbbc";
  const srcMap = sliceReplace2(src, []);
  validateDestCovered(srcMap);
  expect(srcMap.dest).eq(src);
});

test("slice none with start and end", () => {
  const src = "aaabbbc";
  const srcMap = sliceReplace2(src, [], 3, 6);
  validateDestCovered(srcMap);
  expect(srcMap.dest).eq("bbb");
});

test("slice one with start and end", () => {
  const src = "aaabbbc";

  const slices = [{ start: 3, end: 6, replacement: "B" }];
  const srcMap = sliceReplace2(src, slices, 2);
  validateDestCovered(srcMap);
  expect(srcMap.dest).eq("aBc");
});

/** verify that the srcMap covers every part of the destination text */
function validateDestCovered(srcMap: SrcMap): void {
  const { dest, entries } = srcMap;
  let destPos = 0;
  entries.forEach((e) => {
    expect(e.destStart).eq(destPos);
    destPos = e.destEnd;
  });
  expect(destPos).eq(dest.length);
}
