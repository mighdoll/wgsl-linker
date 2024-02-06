import { expect } from "vitest";
import { AbstractElem } from "../AbstractElems.js";
import { matchingLexer } from "../MatchingLexer.js";
import { mainTokens } from "../MatchWgslD.js";
import { OptParserResult, Parser } from "../Parser.js";
import { _withBaseLogger } from "../ParserTracing.js";
import { logCatch } from "./LogCatcher.js";

interface TestParseResult<T> {
  parsed: OptParserResult<T>;
  position: number;
  appState: AbstractElem[];
}

/** utility for testing parsers */
export function testParse<T>(
  p: Parser<T>,
  src: string,
  tokenMatcher = mainTokens
): TestParseResult<T> {
  const lexer = matchingLexer(src, tokenMatcher);
  const app = {
    state: [],
    context: undefined
  };
  const parsed = p.parse({ lexer, app, maxParseCount: 1000 });
  return { parsed, position: lexer.position(), appState: app.state };
}

/** run a test function and expect that no error logs are produced */
export function expectNoLogErr<T>(fn: () => T): T {
  const { log, logged } = logCatch();
  const result = _withBaseLogger(log, fn);
  expect(logged()).eq("");
  return result;
}
