import {
  Parser
} from "mini-parse";
import {
  TestParseResult,
  testParse
} from "mini-parse/test-util";

import {
  AbstractElem
} from "../AbstractElems.js";
import { mainTokens } from "../MatchWgslD.js";
import { parseModule } from "../ParseModule.js";
import { ModuleRegistry } from "../ModuleRegistry.js";
import { linkWgslModule } from "../Linker.js";


export function testAppParse<T>(
  parser: Parser<T>,
  src: string
): TestParseResult<T, AbstractElem> {
  return testParse(parser, src, mainTokens);
}

/** convenience to load modules and immediately link, e.g. for tests. */
export function linkWgslTest(...wgsl: string[]): string {
  const srcModule = parseModule(wgsl[0]);
  const registry = new ModuleRegistry({ rawWgsl: wgsl.slice(1) });
  return linkWgslModule(srcModule, registry);
}