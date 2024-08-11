import { TagRecord, NoTags, Parser } from "mini-parse";
import { testParse, TestParseResult } from "mini-parse/test-util";

import { AbstractElem } from "../AbstractElems.js";
import { mainTokens } from "../MatchWgslD.js";
import { ModuleRegistry } from "../ModuleRegistry.js";
import { dlog } from "berry-pretty";

export function testAppParse<T, N extends TagRecord = NoTags>(
  parser: Parser<T, N>,
  src: string
): TestParseResult<T, N, AbstractElem> {
  return testParse(parser, src, mainTokens);
}

/** convenience to load modules and immediately link, e.g. for tests.
 * The first file is named "root.wgsl", subsequent files are named "file1.wgsl", "file2.wgsl", etc.
 */
export function linkWgslTest(...rawWgsl: string[]): string {
  const [root, ...rest] = rawWgsl;

  const restWgsl = Object.fromEntries(
    rest.map((src, i) => [`./file${i + 1}.wgsl`, src])
  );
  const wgsl = { "./root.wgsl": root, ...restWgsl };

  const registry = new ModuleRegistry({ wgsl });
  return registry.link("./root");
}
