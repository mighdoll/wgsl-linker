import { test, expect } from "vitest";
import { srcLog, srcLine } from "../LinkerLogging.js";
import { logCatch } from "./LogCatcher.js";
import { _withBaseLogger } from "../ParserTracing.js";

test("srcLine", () => {
  const src1 = "1";
  const src2 = "line 2";
  const src3 = " line 3";
  const src = [src1, src2, src3].join("\n");

  const { line: line1 } = srcLine(src, 0);
  expect(line1).equals(src1);

  const { line: line4 } = srcLine(src, 1);
  expect(line4).eq(src1);

  const { line: line5 } = srcLine(src, 2);
  expect(line5).eq(src2);

  const { line: line2 } = srcLine(src, 3);
  expect(line2).eq(src2);

  const { line: line3 } = srcLine(src, 100);
  expect(line3).eq(src3);
});

test("srcLog", () => {
  const src = `a\n12345\nb`;

  const { log, logged } = logCatch();
  _withBaseLogger(log, () => {
    srcLog(src, 5, "uh-oh:");
  });
  expect(logged()).toMatchInlineSnapshot(`
    "uh-oh:
    12345 (Ln 2)
       ^"
  `);
});

test("srcLine on longer example", () => {
  const src = `
    #export(C, D) importing bar(D)
    fn foo(c:C, d:D) { support(d); } 
    
    fn support(d:D) { bar(d); }
    `;
  const { log, logged } = logCatch();
  _withBaseLogger(log, () => {
    srcLog(src, 101, "ugh:");
  });
  expect(logged()).toMatchInlineSnapshot(`
    "ugh:
        fn support(d:D) { bar(d); } (Ln 5)
                          ^"
  `);
});
