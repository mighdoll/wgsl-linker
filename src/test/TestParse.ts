import { expect } from "vitest";
import { matchingLexer } from "../MatchingLexer.js";
import { mainTokens } from "../MatchWgslD.js";
import { logCatch } from "./LogCatcher.js";
import { OptParserResult, Parser } from "../Parser.js";
import { _withErrLogger } from "../LinkerUtil.js";

interface TestParseResult<T> {
  parsed: OptParserResult<T>;
  position: number;
  app: any[];
}

/** utility for testing parsers */
export function testParse<T>(
  p: Parser<T>,
  src: string,
  tokenMatcher = mainTokens
): TestParseResult<T> {
  const lexer = matchingLexer(src, tokenMatcher);
  const app2 = {
    state: [],
    context: undefined,
  };
  const parsed = p.parse({ lexer, app2, maxParseCount: 1000 });
  return { parsed, position: lexer.position(), app: app2.state };
}

/** run a test function and expect that no error logs are produced */
export function expectNoLogErr<T>(fn: () => T): T {
  const { log, logged } = logCatch();
  const result = _withErrLogger(log, fn);
  expect(logged()).eq("");
  return result;
}
