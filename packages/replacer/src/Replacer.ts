import { matchingLexer } from "../../mini-parse/src/MatchingLexer.js";
import { Template } from "../../../src/ModuleRegistry2.js";
import { Parser, setTraceName } from "../../mini-parse/src/Parser.js";
import {
  anyNot,
  eof,
  kind,
  makeEolf,
  opt,
  or,
  repeat,
  seq
} from "../../mini-parse/src/ParserCombinator.js";
import { tracing } from "../../mini-parse/src/ParserTracing.js";
import { patchLine } from "../../../src/PatchLine.js";
import { matchOneOf, tokenMatcher } from "../../mini-parse/src/TokenMatcher.js";

export const replaceTemplate: Template = {
  name: "replace",
  apply: replacer
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
    other: /./
  },
  "replace"
);

const replaceValue = or(
  kind(replaceTokens.word),
  kind(replaceTokens.quote).map((r) => r.value.slice(1, -1))
);

const nameValue = seq(replaceValue, "=", replaceValue)
  .map((r) => [r.value[0], r.value[2]])
  .named("nameValue");

// prettier-ignore
const replaceClause = seq(
  "//", 
  "#replace", 
  nameValue, 
  repeat(nameValue), 
)

const eolf = makeEolf(replaceTokens, replaceTokens.ws);

const lineStart = seq(anyNot(replaceClause), repeat(anyNot(replaceClause))).map(
  (r) => r.src.slice(r.start, r.end)
);

const line = seq(lineStart.named("line"), opt(replaceClause), eolf).map((r) => {
  const line = r.named.line[0];
  const patched = patchLine(r.ctx, line, r.named.nameValue ?? []);
  r.app.state.push(patched);
});

const root = seq(repeat(line), eof());

export function replacer(src: string, params: Record<string, any>): string {
  const lexer = matchingLexer(src, replaceTokens);
  const lines: string[] = [];
  const app = { state: lines, context: params };
  root.parse({ lexer, app, maxParseCount: 1000 });

  return lines.join("\n");
}

// enableTracing();
if (tracing) {
  const names: Record<string, Parser<unknown>> = {
    replaceValue,
    nameValue,
    replaceClause,
    lineStart,
    line,
    root
  };

  Object.entries(names).forEach(([name, parser]) => {
    setTraceName(parser, name);
  });
}