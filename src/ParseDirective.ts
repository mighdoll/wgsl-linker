import { ExportElem, ImportElem } from "./AbstractElems.js";
import { resultErr, srcErr } from "./LinkerUtil.js";
import { argsTokens, lineCommentTokens, mainTokens } from "./MatchWgslD.js";
import { ExtendedResult, Parser } from "./Parser.js";
import {
  any,
  kind,
  not,
  opt,
  or,
  repeat,
  repeatWhile,
  req,
  seq,
} from "./ParserCombinator.js";
import { eolf, makeElem, wordArgsLine } from "./ParseSupport.js";
import { ParseState } from "./ParseWgslD.js";

/* parse #directive enhancements to wgsl: #import, #export, #if, #else, etc. */

/** foo <(A,B)> <as boo> <from bar>  EOL */
const importPhrase = seq(
  kind(argsTokens.word).named("name"),
  opt(wordArgsLine.named("args")),
  opt(seq("as", kind(argsTokens.word).named("as"))),
  opt(seq("from", kind(argsTokens.word).named("from")))
)
  .map((r) => {
    // flatten 'args' by putting it with the other extracted names
    const named: (keyof ImportElem)[] = ["name", "from", "as", "args"];
    return makeElem<ImportElem>("import", r, named, []);
  })
  .traceName("importElem");

export const importing = seq(
  "importing",
  seq(importPhrase.named("importing")),
  repeat(seq(",", importPhrase.named("importing")))
).traceName("importing");

/** #import foo <(a,b)> <as boo> <from bar>  EOL */
const importDirective = seq(
  "#import",
  seq(importPhrase.named("i"), eolf).tokens(argsTokens)
)
  .map((r) => {
    const imp: ImportElem = r.named.i[0];
    imp.start = r.start; // use start of #import, not import phrase
    r.app.push(imp);
  })
  .traceName("import");

/** #export <foo> <(a,b)> <importing bar(a) <zap(b)>* > EOL */
// prettier-ignore
export const exportDirective = seq(
  "#export",
    seq(
      opt(kind(argsTokens.word).named("name")), 
      opt(wordArgsLine.named("args")), 
      opt(importing), 
      eolf
    ).tokens(argsTokens)
)
  .map((r) => {
    // flatten 'args' by putting it with the other extracted names
    const e = makeElem<ExportElem>("export", r, ["name", "args"], ["importing"]);
    r.app.push(e);
  })
  .traceName("export");

// prettier-ignore
const ifDirective: Parser<any> = seq(
  "#if",
  seq(
    opt("!").named("invert"), 
    req(kind(mainTokens.word).named("name")), 
    eolf
  )
    .tokens(argsTokens)
    .toParser((r) => {
      const { params } = r.appState as ParseState;
      const ifArg = r.named["name"]?.[0] as string;
      const invert = r.named["invert"]?.[0] === "!";
      const arg = !!params[ifArg];
      const truthy = invert ? !arg : arg;
      return ifBody(r, truthy);
    })
).traceName("#if");

const elseDirective = seq("#else", eolf)
  .toParser((r) => {
    const { ifStack } = r.appState as ParseState;
    const ifState = ifStack.pop();
    if (ifState === undefined) srcErr(r.src, r.start, "unmatched #else");
    return ifBody(r, !ifState);
  })
  .traceName("#else");

const notIfDirective = seq(not("#if"), not("#else"), not("#endif"), any());

/** consume everything until we get to #else or #endif */
const skipIfBody = repeatWhile(notIfDirective, (r) => {
  const { ifStack } = r.appState as ParseState;
  const active = ifStack.slice(-1)[0];
  if (!active) {
    // srcErr(r.src, r.start, "skipping", ifStack);
    return true; // skip
  }
}).traceName("skipIfBody");

function ifBody(
  r: ExtendedResult<any>,
  truthy: boolean
): Parser<any> | undefined {
  const { ifStack } = r.appState as ParseState;
  // srcErr(r.src, r.start, "ifBody", truthy);
  ifStack.push(truthy);
  if (!truthy) return skipIfBody;
}

const endifDirective = seq("#endif", eolf)
  .map((r) => {
    // srcErr(r.src, r.start, "#endif");
    const { ifStack } = r.appState as ParseState;
    const ifState = ifStack.pop();
    if (ifState === undefined) resultErr(r, "unmatched #endif");
  })
  .traceName("#endif");

export const directive = or(
  exportDirective,
  importDirective,
  ifDirective,
  elseDirective,
  endifDirective
).traceName("directive");

/** parse a line comment possibly containg a #directive
 *    // <#import|#export|any>
 * if a directive is found it is handled internally (e.g.
 * by pushing an AbstractElem to the app context) */
export const lineCommentOptDirective = seq(
  "//",
  or(directive, kind(lineCommentTokens.notDirective).tokens(lineCommentTokens))
)
  .tokens(mainTokens)
  .traceName("lineComment");
