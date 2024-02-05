import { matchingLexer } from "./MatchingLexer.js";
import { Template } from "./ModuleRegistry2.js";
import {
  anyNot,
  eof,
  kind,
  makeEolf,
  opt,
  or,
  repeat,
  seq,
} from "./ParserCombinator.js";
import { enableTracing } from "./ParserTracing.js";
import { patchLine } from "./PatchLine.js";
import { matchOneOf, tokenMatcher } from "./TokenMatcher.js";

export const replaceTemplate: Template = {
  name: "replace",
  apply: replacer,
};

const symbolSet = "= //";
export const replaceTokens = tokenMatcher(
  {
    ws: /[ \t]+/,
    eol: /\n/,
    quote: /"[^"\n]+"/,
    word: /[\w-.]+/,
    directive: /#[\w-.]+/,
    symbol: matchOneOf(symbolSet),
    other: /./,
  },
  "replace"
);

const replaceValue = or(
  kind(replaceTokens.word),
  kind(replaceTokens.quote).map((r) => r.value.slice(1, -1))
);

const nameValue = seq(replaceValue, "=", replaceValue)
  .map((r) => [r.value[0], r.value[2]])
  .named("nameValue")
  .traceName("nameValue");

// prettier-ignore
const replaceClause = seq(
  "//", 
  "#replace", 
  nameValue, 
  repeat(nameValue), 
).traceName("replaceClause");

const eolf = makeEolf(replaceTokens, replaceTokens.ws);

const lineStart = seq(anyNot(replaceClause), repeat(anyNot(replaceClause)))
  .map((r) => r.src.slice(r.start, r.end))
  .traceName("lineStart");

const line = seq(lineStart.named("line"), opt(replaceClause), eolf)
  .map((r) => {
    const line = r.named.line[0];
    const patched = patchLine(r.ctx, line, r.named.nameValue ?? []);
    r.app.state.push(patched);
  })
  .traceName("line");

// enableTracing();
const root = seq(repeat(line), eof()).traceName("root");

export function replacer(src: string, extParams: Record<string, any>): string {
  const lexer = matchingLexer(src, replaceTokens);
  const lines: string[] = [];
  const app = { state: lines, context: extParams };
  root.parse({ lexer, app, maxParseCount: 1000 });

  return lines.join("\n");
}
