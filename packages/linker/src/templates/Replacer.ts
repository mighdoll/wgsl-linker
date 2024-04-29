import {
  anyNot,
  kind,
  makeEolf,
  matchingLexer,
  matchOneOf,
  or,
  Parser,
  repeat,
  seq,
  setTraceName,
  SrcMap,
  tokenMatcher,
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

const replaceClause = seq("//", "#replace", nameValue, repeat(nameValue));

const notReplace = anyNot(replaceClause);

const lineStart = seq(notReplace, repeat(notReplace)).map((r) =>
  r.src.slice(r.start, r.end)
);

// prettier-ignore
const lineWithReplace = seq(
  lineStart.named("line"), 
  replaceClause, 
  eolf
).map(
  (r) => {
    const line = r.named.line[0];
    const patched = patchLine(r.ctx, line, r.named.nameValue ?? []);
    return patched;
  }
);

export function replacer(src: string, params: Record<string, any>): SrcMap {
  const srcLines = src.split("\n");

  const lines = srcLines.map((line) => {
    const replaced = lineWithReplace.parse({
      lexer: matchingLexer(line, replaceTokens),
      app: { state: [], context: params },
    });
    return replaced?.value || line;
  });

  const text = lines.join("\n");
  return new SrcMap(text);
}

if (tracing) {
  const names: Record<string, Parser<unknown>> = {
    replaceValue,
    nameValue,
    replaceClause,
    notReplace,
    lineWithReplace,
    lineStart, // TODO tracing label doesn't work
  };

  Object.entries(names).forEach(([name, parser]) => {
    setTraceName(parser, name);
  });
}
