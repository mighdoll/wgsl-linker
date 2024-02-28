/* handle #if #else #endif */
import {
  ExtendedResult,
  Parser,
  any,
  anyThrough,
  eof,
  kind,
  makeEolf,
  matchOneOf,
  matchingLexer,
  opt,
  or,
  repeat,
  req,
  resultLog,
  seq,
  setTraceName,
  tokenMatcher,
  tracing,
} from "mini-parse";
import { directive, eol } from "./MatchWgslD.js";
import { ParseState } from "./ParseWgslD.js";

export const conditionalsTokens = tokenMatcher(
  {
    directive,
    eol,
    ws: /[ \t]+/,
    symbol: matchOneOf("// !"),
    word: /[^\s\n]+/,
  },
  "conditionals"
);

const eolf = makeEolf(conditionalsTokens, conditionalsTokens.ws);

const ifDirective: Parser<any> = seq(
  "#if",
  seq(
    opt("!").named("invert"),
    req(kind(conditionalsTokens.word).named("name")),
    eolf
  ).map((r) => {
    // extract args
    const ifArg = r.named["name"]?.[0] as string;
    const invert = r.named["invert"]?.[0] === "!";

    // lookup whether #if arg is truthy or not in paramsa, and invert for ! prefix
    const { params } = r.app.state;
    const arg = !!params[ifArg];
    const truthy = invert ? !arg : arg;

    pushIfState(r, truthy);
  })
);

const elseDirective = seq("#else", eolf).map((r) => {
  const oldTruth = popIfState(r);
  if (oldTruth === undefined) resultLog(r, "unmatched #else");
  pushIfState(r, !oldTruth);
});

const endifDirective = seq("#endif", eolf).map((r) => {
  const oldTruth = popIfState(r);
  if (oldTruth === undefined) resultLog(r, "unmatched #endif");
});

const directiveLine = seq(
  opt("//"),
  or(ifDirective, elseDirective, endifDirective)
);

const lastLine = seq(any(), repeat(any()), eof());

const line = or(anyThrough("\n"), lastLine).map((r) => {
  if (!skippingIfBody(r)) {
    r.app.state.lines.push(r.src.slice(r.start, r.end));
  }
});

const srcLines = seq(repeat(or(directiveLine, line)), eof());

function skippingIfBody(r: ExtendedResult<unknown, ParseState>): boolean {
  return !r.app.context.ifStack.every((truthy) => truthy);
}

function pushIfState<T>(
  r: ExtendedResult<T, ParseState>,
  truthy: boolean
): void {
  const origContext = r.app.context;
  const ifStack = [...origContext.ifStack, truthy]; // push truthy onto ifStack
  r.app.context = { ...origContext, ifStack }; // revise app context with new ifStack
}

function popIfState<T>(r: ExtendedResult<T, ParseState>): boolean | undefined {
  const origContext = r.app.context;

  // pop element from stack
  const ifStack = [...origContext.ifStack];
  const result = ifStack.pop();

  // revise app context with new ifStack
  r.app.context = { ...origContext, ifStack };

  return result;
}

/** preprocess a src string to handle #if #else #endif, etc. */
export function processConditionals(
  src: string,
  params: Record<string, any>
): string {
  const lines: string[] = [];
  srcLines.parse({
    lexer: matchingLexer(src, conditionalsTokens),
    app: { context: { ifStack: [] }, state: { lines, params } },
    maxParseCount: 1000,
  });
  return lines.join("\n");
}

/** debug for recognizer */
if (tracing) {
  const names: Record<string, Parser<unknown>> = {
    ifDirective,
    elseDirective,
    endifDirective,
    directiveLine,
    lastLine,
    line,
  };

  Object.entries(names).forEach(([name, parser]) => {
    setTraceName(parser, name);
  });
}
