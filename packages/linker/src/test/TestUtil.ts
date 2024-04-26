import { Parser } from "mini-parse";
import { testParse, TestParseResult } from "mini-parse/test-util";

import { AbstractElem } from "../AbstractElems.js";
import { mainTokens } from "../MatchWgslD.js";
import { ModuleRegistry } from "../ModuleRegistry.js";

export function testAppParse<T>(
  parser: Parser<T>,
  src: string
): TestParseResult<T, AbstractElem> {
  return testParse(parser, src, mainTokens);
}

/** convenience to load modules and immediately link, e.g. for tests. */
export function linkWgslTest(...rawWgsl: string[]): string {
  const wgsl = Object.fromEntries(rawWgsl.map((src, i) => [`./file${i}`, src]));
  const registry = new ModuleRegistry({ wgsl });
  return registry.link("./file0");
}
