import { expect } from "vitest";
import { matchingLexer } from "../MatchingLexer.js";
import { OptParserResult, Parser } from "../Parser.js";
import { _withBaseLogger } from "../ParserTracing.js";
import { TokenMatcher, matchOneOf, tokenMatcher } from "../TokenMatcher.js";
import { logCatch } from "./LogCatcher.js";

const symbolSet =
  "& && -> @ / ! [ ] { } : , = == != > >= < << <= % - -- " + 
  ". + ++ | || ( ) ; * ~ ^ // /* */ += -= *= /= %= &= |= ^= >>= <<= <<";
const defaultTokens = tokenMatcher({
  directive: /#[a-zA-Z_]\w*/,
  word: /[a-zA-Z_]\w*/,
  attr: /@[a-zA-Z_]\w*/,
  symbol: matchOneOf(symbolSet),
  digits: /\d+/,
  ws: /\s+/,
});

export interface TestParseResult<T, S = any> {
  parsed: OptParserResult<T>;
  position: number;
  appState: S[];
}

/** utility for testing parsers */
export function testParse<T, S = any>(
  p: Parser<T>,
  src: string,
  tokenMatcher: TokenMatcher = defaultTokens
): TestParseResult<T, S> {
  const lexer = matchingLexer(src, tokenMatcher);
  const app = {
    state: [],
    context: undefined,
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
