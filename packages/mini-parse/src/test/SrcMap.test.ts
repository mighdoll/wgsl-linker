import { expect, test } from "vitest";
import { SrcMap } from "../SrcMap.js";

test("compact", () => {
  const src = "a b";
  const dest = "|" + src + " d";

  const srcMap = new SrcMap(dest);
  srcMap.addEntries([
    { src, srcStart: 0, srcEnd: 2, destStart: 1, destEnd: 3 },
    { src, srcStart: 2, srcEnd: 3, destStart: 3, destEnd: 4 },
  ]);
  srcMap.compact();
  expect(srcMap.entries).toMatchInlineSnapshot(`
    [
      {
        "destEnd": 4,
        "destStart": 1,
        "src": "a b",
        "srcEnd": 3,
        "srcStart": 0,
      },
    ]
  `);
});
