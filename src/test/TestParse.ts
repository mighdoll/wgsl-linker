import { matchingLexer } from "../MatchingLexer.js";
import { mainTokens } from "../MatchWgslD.js";
import { OptParserResult, ParserStage } from "../ParserCombinator.js";

interface TestParseResult<T> {
  parsed: OptParserResult<T>;
  position: number;
  app: any[];
}

/** utility for testing parsers */
export function testParse<T>(
  p: ParserStage<T>,
  src: string,
  tokenMatcher = mainTokens
): TestParseResult<T> {
  const lexer = matchingLexer(src, tokenMatcher);
  const app: any[] = [];
  const parsed = p({ lexer, app });
  return { parsed, position: lexer.position(), app };
}
