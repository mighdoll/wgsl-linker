import {
  Parser,
  anyNot,
  enableTracing,
  eof,
  kind,
  makeEolf,
  matchOneOf,
  matchingLexer,
  opt,
  or,
  repeat,
  seq,
  setTraceName,
  srcLog,
  tokenMatcher,
  tokenSkipSet,
  tracing,
} from "mini-parse";
import { Template } from "wgsl-linker";
import { patchLine } from "./PatchLine.js";

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

const eolf = makeEolf(replaceTokens, replaceTokens.ws);

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

const notReplace = anyNot(or(replaceClause, "\n"));

const lineStart = seq(notReplace, repeat(notReplace)).map((r) =>
  r.src.slice(r.start, r.end)
);

const lineWithOptReplace = seq(
  lineStart.named("line"),
  opt(replaceClause),
  eolf
).map((r) => {
  const line = r.named.line[0];
  const patched = patchLine(r.ctx, line, r.named.nameValue ?? []);
  r.app.state.push(patched);
});

const ws = kind(replaceTokens.ws);

// prettier-ignore
const blankLine = tokenSkipSet(null, 
  or(
    seq(ws, eolf),  // match eof only if there is ws, lest we loop on eof
    seq(opt(ws), "\n")
  )
);

const line = or(blankLine, lineWithOptReplace);

const root = seq(repeat(line), eof());

export function replacer(src: string, params: Record<string, any>): string {
  const lexer = matchingLexer(src, replaceTokens);
  const lines: string[] = [];
  const app = { state: lines, context: params };
  root.parse({ lexer, app }) ||
    srcLog(src, lexer.position(), "Replacer: parse failed");
  // const r = root.parse({ lexer, app });
  // if (!r) {
  //   throw new Error("Replacer: parse failed");
  // }

  return lines.join("\n");
}

if (tracing) {
  const names: Record<string, Parser<unknown>> = {
    blankLine,
    replaceValue,
    nameValue,
    replaceClause,
    notReplace,
    lineWithOptReplace,
    line,
    lineStart, // TODO tracing label doesn't work
    root,
  };

  Object.entries(names).forEach(([name, parser]) => {
    setTraceName(parser, name);
  });
}
