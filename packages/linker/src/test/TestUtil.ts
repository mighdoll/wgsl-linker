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


export function testAppParse<T>(
  parser: Parser<T>,
  src: string
): TestParseResult<T, AbstractElem> {
  return testParse(parser, src, mainTokens);
}