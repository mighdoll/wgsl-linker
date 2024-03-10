import {
  Parser,
  anyThrough,
  kind,
  opt,
  or,
  repeat,
  req,
  seq,
  setTraceName,
  tokens,
  tracing,
  withSep,
} from "mini-parse";
import {
  ExportElem,
  ImportElem,
  ExtendsElem,
  NamedElem,
} from "./AbstractElems.js";
import {
  argsTokens,
  lineCommentTokens,
  mainTokens,
  moduleTokens,
} from "./MatchWgslD.js";
import { eolf, makeElem } from "./ParseSupport.js";

/* parse #directive enhancements to wgsl: #import, #export, etc. */

const argsWord = kind(argsTokens.arg);

// prettier-ignore
/** ( <a> <,b>* )  with optional comments interspersed, does not span lines */
export const directiveArgs: Parser<string[]> = 
  seq(
    "(", 
    withSep(",", argsWord), 
    req(")")
  ).map((r) => r.value[1]);

/** foo <(A,B)> <as boo> <from bar>  EOL */
function importPhrase<T extends ImportElem | ExtendsElem>(
  kind: T["kind"]
): Parser<T> {
  const p = seq(
    argsWord.named("name"),
    opt(directiveArgs.named("args")),
    opt(seq("as", argsWord.named("as"))),
    opt(seq("from", argsWord.named("from")))
  ).map((r) => {
    // flatten 'args' by putting it with the other extracted names
    const named: (keyof T)[] = ["name", "from", "as", "args"];
    return makeElem<T>(kind, r, named, []);
  });

  return p;
}

const importElemPhrase = importPhrase<ImportElem>("import");
const importMergeElemPhrase = importPhrase<ExtendsElem>("extends");

export const importing = seq(
  "importing",
  seq(importElemPhrase.named("importing")),
  repeat(seq(",", importElemPhrase.named("importing")))
);

/** #import foo <(a,b)> <as boo> <from bar>  EOL */
const importDirective = seq(
  "#import",
  seq(importElemPhrase.named("i"), eolf)
).map((r) => {
  const imp: ImportElem = r.named.i[0];
  imp.start = r.start; // use start of #import, not import phrase
  r.app.state.push(imp);
});

const importMergeSym = Symbol("extends");

export const importMergeDirective = seq(
  "#extends",
  seq(importMergeElemPhrase.named(importMergeSym), eolf)
).map((r) => {
  const imp: ExtendsElem = r.named[importMergeSym][0];
  imp.start = r.start; // use start of #import, not import phrase
  r.app.state.push(imp);
});

/** #export <foo> <(a,b)> <importing bar(a) <zap(b)>* > EOL */
export const exportDirective = seq(
  "#export",
  seq(opt(directiveArgs.named("args")), opt(importing), eolf)
).map((r) => {
  // flatten 'args' by putting it with the other extracted names
  const e = makeElem<ExportElem>("export", r, ["args"], ["importing"]);
  r.app.state.push(e);
});

const moduleDirective = oneArgDirective("module");

const templateDirective = oneArgDirective("template");

function oneArgDirective<T extends NamedElem>(
  elemKind: T["kind"]
): Parser<void> {
  return seq(
    `#${elemKind}`,
    tokens(moduleTokens, req(kind(moduleTokens.moduleName).named("name"))),
    eolf
  ).map((r) => {
    const e = makeElem<T>(elemKind, r, ["name"]);
    r.app.state.push(e);
  });
}

export const directive = tokens(
  argsTokens,
  seq(
    repeat("\n"),
    or(
      exportDirective,
      importDirective,
      importMergeDirective,
      moduleDirective,
      templateDirective
    )
  )
);

const skipToEol = tokens(lineCommentTokens, anyThrough(eolf));

/** parse a line comment possibly containg a #directive
 *    // <#import|#export|any>
 * if a directive is found it is handled internally (e.g.
 * by pushing an AbstractElem to the app context) */
export const lineCommentOptDirective = seq(
  tokens(mainTokens, "//"),
  or(directive, skipToEol)
);

// enableTracing();
if (tracing) {
  const names: Record<string, Parser<unknown>> = {
    directiveArgs,
    importElemPhrase,
    importMergeElemPhrase,
    importing,
    importDirective,
    importMergeDirective,
    exportDirective,
    lineCommentOptDirective,
    moduleDirective,
    templateDirective,
    directive,
  };

  Object.entries(names).forEach(([name, parser]) => {
    setTraceName(parser, name);
  });
}
