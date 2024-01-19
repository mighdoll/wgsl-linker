import { ExportElem, ImportElem } from "./AbstractElems.js";
import {
  argsTokens,
  lineCommentTokens,
  mainTokens,
} from "./MatchWgslD.js";
import { ExtendedResult, Parser } from "./Parser.js";
import {
  any,
  fn,
  kind,
  not,
  opt,
  or,
  repeat,
  seq,
  tokens,
} from "./ParserCombinator.js";
import { eol, wordArgsLine } from "./ParseSupport.js";
import { makeElem, ParseState } from "./ParseWgslD.js";

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
  tokens(argsTokens, seq(importPhrase.named("i"), eol))
)
  .map((r) => {
    const imp: ImportElem = r.named.i[0];
    imp.start = r.start; // use start of #import, not import phrase
    r.app.push(imp);
  })
  .traceName("import");

/** #export <foo> <(a,b)> <importing bar(a) <zap(b)>* > EOL */
// prettier-ignore
const exportDirective = seq(
  "#export",
  tokens(
    argsTokens,
    seq(
      opt(kind(argsTokens.word).named("name")), 
      opt(wordArgsLine.named("args")), 
      opt(importing), 
      eol
    )
  )
)
  .map((r) => {
    // flatten 'args' by putting it with the other extracted names
    const e = makeElem<ExportElem>("export", r, ["name", "args"], ["importing"]);
    r.app.push(e);
  })
  .traceName("export");

const ifDirective: Parser<any> = seq(
  "#if",
  tokens(
    argsTokens,
    seq(opt("!").named("invert"), kind(mainTokens.word).named("name"), eol)
  ).toParser((r) => {
    const { params } = r.appState as ParseState;
    const ifArg = r.named["name"]?.[0] as string;
    const invert = r.named["invert"]?.[0] === "!";
    const arg = !!params[ifArg];
    const truthy = invert ? !arg : arg;
    return ifBody(r, truthy);
  })
).traceName("#if");

const elseDirective = seq("#else", tokens(argsTokens, eol))
  .toParser((r) => {
    const { ifStack } = r.appState as ParseState;
    const ifState = ifStack.pop();
    if (ifState === undefined) console.warn("unmatched #else", r.start);
    return ifBody(r, !ifState);
  })
  .traceName("#else");

// prettier-ignore
const skipUntilElseEndif = repeat(
  seq(
    or(
      fn(() => lineCommentOptDirective),  
      seq(
        not("#else"), 
        not("#endif"),
        any()
      ), 
    )
  )
).traceName("skipTo #else/#endif");

function ifBody(
  r: ExtendedResult<any>,
  truthy: boolean
): Parser<any> | undefined {
  const { ifStack } = r.appState as ParseState;
  ifStack.push(truthy);
  if (!truthy) return skipUntilElseEndif;
}

const endifDirective = seq("#endif", tokens(argsTokens, eol))
  .map((r) => {
    const { ifStack } = r.appState as ParseState;
    const ifState = ifStack.pop();
    if (ifState === undefined) console.warn("unmatched #endif", r.start);
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
  tokens(lineCommentTokens, or(directive, kind(lineCommentTokens.notDirective)))
).traceName("lineComment");
