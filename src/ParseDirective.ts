import {
  AbstractElem,
  ExportElem,
  ImportElem,
  ImportMergeElem,
  ModuleElem,
  NamedElem,
} from "./AbstractElems.js";
import { resultLog, srcLog } from "./LinkerUtil.js";
import {
  argsTokens,
  lineCommentTokens,
  mainTokens,
  moduleTokens,
} from "./MatchWgslD.js";
import { ExtendedResult, Parser, ParserContext } from "./Parser.js";
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
  withSep,
} from "./ParserCombinator.js";
import { eolf, makeElem } from "./ParseSupport.js";
import { ParseState } from "./ParseWgslD.js";

/* parse #directive enhancements to wgsl: #import, #export, #if, #else, etc. */

const argsWord = kind(argsTokens.arg);

// prettier-ignore
/** ( <a> <,b>* )  with optional comments interspersed, does not span lines */
export const directiveArgs: Parser<string[]> = 
  seq(
    "(", 
    withSep(",", argsWord), 
    req(")")
  )
.tokens(argsTokens)
  .map((r) => r.value[1])
  .traceName("wordArgs");

/** foo <(A,B)> <as boo> <from bar>  EOL */
function importPhrase<T extends ImportElem | ImportMergeElem>(
  kind: T["kind"]
): Parser<T> {
  const p = seq(
    argsWord.named("name"),
    opt(directiveArgs.named("args")),
    opt(seq("as", argsWord.named("as"))),
    opt(seq("from", argsWord.named("from")))
  )
    .map((r) => {
      // flatten 'args' by putting it with the other extracted names
      const named: (keyof T)[] = ["name", "from", "as", "args"];
      return makeElem<T>(kind, r, named, []);
    })
    .traceName("importPhrase-" + kind);

  return p;
}

const importElemPhrase = importPhrase<ImportElem>("import");
const importMergeElemPhrase = importPhrase<ImportMergeElem>("importMerge");

export const importing = seq(
  "importing",
  seq(importElemPhrase.named("importing")),
  repeat(seq(",", importElemPhrase.named("importing")))
)
  .tokens(argsTokens)
  .traceName("importing");

/** #import foo <(a,b)> <as boo> <from bar>  EOL */
const importDirective = seq(
  "#import",
  seq(importElemPhrase.named("i"), eolf).tokens(argsTokens)
)
  .map((r) => {
    const imp: ImportElem = r.named.i[0];
    imp.start = r.start; // use start of #import, not import phrase
    r.app.state.push(imp);
  })
  .traceName("import");

const importMergeSym = Symbol("importMerge");

export const importMergeDirective = seq(
  "#importMerge",
  seq(importMergeElemPhrase.named(importMergeSym), eolf).tokens(argsTokens)
)
  .map((r) => {
    const imp: ImportMergeElem = r.named[importMergeSym][0];
    imp.start = r.start; // use start of #import, not import phrase
    r.app.state.push(imp);
  })
  .traceName("importMerge");

/** #export <foo> <(a,b)> <importing bar(a) <zap(b)>* > EOL */
// prettier-ignore
export const exportDirective = seq(
  "#export",
    seq(
      opt(directiveArgs.named("args")), 
      opt(importing), 
      eolf
    ).tokens(argsTokens)
)
  .map((r) => {
    // flatten 'args' by putting it with the other extracted names
    const e = makeElem<ExportElem>("export", r, ["args"], ["importing"]);
    r.app.state.push(e);
  })
  .traceName("export");

// prettier-ignore
const ifDirective: Parser<any> = seq(
  "#if",
  seq(
    opt("!").named("invert"), 
    req(argsWord.named("name")), 
    eolf
  )
    .tokens(argsTokens)
    .toParser((r) => {
      // check if #if true or false
      const { params } = r.app.context;
      const ifArg = r.named["name"]?.[0] as string;
      const invert = r.named["invert"]?.[0] === "!";
      const arg = !!params[ifArg];
      const truthy = invert ? !arg : arg;
      // resultErr(r, "#if", truthy);
      pushIfState(r, truthy);

      return ifBody(r);
    })
).traceName("#if");

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
  const ifStack = [...origContext.ifStack]; // pop element
  const result = ifStack.pop();
  r.app.context = { ...origContext, ifStack }; // revise app context with new ifStack
  return result;
}

function ifBody(
  r: ExtendedResult<unknown, ParseState>
): Parser<unknown> | undefined {
  if (skippingIfBody(r)) return skipIfBody;
}

function skippingIfBody(r: ExtendedResult<unknown, ParseState>): boolean {
  return !r.app.context.ifStack.every((truthy) => truthy);
}

const elseDirective = seq("#else", eolf)
  .toParser((r) => {
    const oldTruth = popIfState(r);
    if (oldTruth === undefined) resultLog(r, "unmatched #else");
    pushIfState(r, !oldTruth);
    return ifBody(r);
  })
  .traceName("#else");

const notIfDirective = seq(not("#if"), not("#else"), not("#endif"), any());

const endifDirective = seq("#endif", eolf)
  .map((r) => {
    const oldTruth = popIfState(r);
    if (oldTruth === undefined) resultLog(r, "unmatched #endif");
    // else resultErr(r, "#endif");
  })
  .traceName("#endif");

const moduleDirective = oneArgDirective("module").traceName("#module");

const templateDirective = oneArgDirective("template").traceName("#template");

function oneArgDirective<T extends NamedElem>(
  elemKind: T["kind"]
): Parser<void> {
  return seq(
    `#${elemKind}`,
    req(kind(moduleTokens.moduleName).named("name").tokens(moduleTokens)),
    eolf
  )
    .map((r) => {
      const e = makeElem<T>(elemKind, r, ["name"]);
      r.app.state.push(e);
    })
    .traceName(`#${elemKind}`);
}

export const directive = or(
  exportDirective,
  importDirective,
  importMergeDirective,
  ifDirective,
  elseDirective,
  endifDirective,
  moduleDirective,
  templateDirective
)
  .tokens(argsTokens)
  .traceName("directive");

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

/** consume everything until we get to #else or #endif */
const skipIfBody = repeatWhile(notIfDirective, skippingIfBody).traceName(
  "skipIfBody"
);
