import {
  Parser,
  TagRecord,
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
import { ExtendsElem, ImportElem, NamedElem } from "./AbstractElems.js";
import {
  argsTokens,
  lineCommentTokens,
  mainTokens,
  moduleTokens,
} from "./MatchWgslD.js";
import { eolf, makeElem } from "./ParseSupport.js";

/* parse #directive enhancements to wgsl: #import, #export, etc. */

const argsWord = kind(argsTokens.arg);
const fromWord = or(argsWord, kind(argsTokens.relPath));

// prettier-ignore
/** ( <a> <,b>* ) */
export const directiveArgs: Parser<string[]> = 
  seq(
    "(", 
    withSep(",", argsWord), 
    req(")")
  ).map((r) => r.value[1]);

const fromClause = seq(
  "from",
  or(
    fromWord.tag("from"), 
    seq('"', fromWord.tag("from"), '"'),
  )
);

/** foo <(A,B)> <as boo> <from bar> */
function importPhrase<T extends ImportElem | ExtendsElem>(
  kind: T["kind"]
): Parser<T> {
  const p = seq(
    or(argsWord.tag("name"), seq("{", argsWord.tag("name"), "}")),
    opt(directiveArgs.tag("args")),
    opt(seq("as", argsWord.tag("as"))),
    opt(fromClause)
  ).map((r) => {
    // flatten 'args' by putting it with the other extracted names
    const named: (keyof T)[] = ["name", "from", "as", "args"];
    return makeElem(kind, r as any, named as any, []) as unknown as T;
  });

  return p;
}

const importElemPhrase = importPhrase<ImportElem>("import");
const extendsElemPhrase = importPhrase<ExtendsElem>("extends");

/** #import foo <(a,b)> <as boo> <from bar>  EOL */
const importDirective = seq(
  or("#import", "import"),
  seq(importElemPhrase.tag("i"), opt(";"), eolf)
).map((r) => {
  const imp: ImportElem = r.tags.i[0];
  imp.start = r.start; // use start of #import, not import phrase
  r.app.state.push(imp);
});

const extendsTag = "-extends-";

export const extendsDirective = seq(
  "#extends",
  seq(extendsElemPhrase.tag(extendsTag), eolf)
).map((r) => {
  const imp: ExtendsElem = r.tags[extendsTag][0];
  imp.start = r.start; // use start of #import, not import phrase
  r.app.state.push(imp);
});

export const importing = seq(
  "importing",
  seq(importElemPhrase.tag("importing")),
  repeat(seq(",", importElemPhrase.tag("importing")))
);

/** #export <foo> <(a,b)> <importing bar(a) <zap(b)>* > EOL */
export const exportDirective = seq(
  or("#export", "export"),
  seq(opt(directiveArgs.tag("args")), opt(importing), opt(eolf))
).map((r) => {
  // flatten 'args' by putting it with the other extracted names
  const e = makeElem("export", r, ["args"], ["importing"]);
  r.app.state.push(e);
});

const moduleDirective = oneArgDirective("module");

const templateDirective = oneArgDirective("template");

function oneArgDirective<T extends NamedElem>(
  elemKind: T["kind"]
): Parser<void, TagRecord> {
  return seq(
    `#${elemKind}`,
    tokens(moduleTokens, req(kind(moduleTokens.moduleName).tag("name"))),
    eolf
  ).map((r) => {
    const e = makeElem(elemKind, r, ["name"] as any);
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
      extendsDirective,
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
  const names: Record<string, Parser<unknown, TagRecord>> = {
    directiveArgs,
    importElemPhrase,
    extendsElemPhrase,
    importing,
    importDirective,
    extendsDirective,
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
