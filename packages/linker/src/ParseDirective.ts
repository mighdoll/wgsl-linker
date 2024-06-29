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
  or(fromWord.tag("from"), seq('"', fromWord.tag("from"), '"'))
);

interface ImportClause {
  name: string;
  as?: string;
  args?: string[];
}

// prettier-ignore
/** foo <(A,B)> <as bar> */
const importClause = seq(
  argsWord.tag("name"),
  opt(directiveArgs.tag("args")),
  opt(seq("as", argsWord.tag("as")))
).map(r =>
  ({ name: r.tags.name[0],
    as: r.tags.as?.[0],
    args: r.tags.args?.[0],
  }) as ImportClause
).tag("importClause");

const importList = withSep(",", importClause, { requireOne: true });

// prettier-ignore
const bracketedImportClause = or(
  importList, 
  seq("{", importList, "}")
);

/** <{> foo <,zip> <(A,B)> <as boo> <}> <from bar> */
function importPhrase<T extends ImportElem | ExtendsElem>(
  kind: T["kind"]
): Parser<T[]> {
  const p = seq(bracketedImportClause, opt(fromClause)).map((r) => {
    const from = r.tags.from?.[0];
    return r.tags.importClause.map((impClause) => {
      const elem = makeElem(kind, r as any, [], []) as unknown as T;
      copyDefinedProps(impClause, ["name", "as", "args"], elem);
      if (from) elem.from = from;
      return elem;
    });
  });

  return p;
}

const importElemPhrase = importPhrase<ImportElem>("import");
const extendsElemPhrase = importPhrase<ExtendsElem>("extends");

/** #import foo <(a,b)> <as boo> <from bar>  EOL */
const importDirective = seq(
  or("#import", "import"),
  seq(importElemPhrase.tag("imp"), opt(";"), eolf)
).map((r) => {
  r.tags.imp[0].forEach((imp) => {
    imp.start = r.start; // use start of #import, not import phrase
    r.app.state.push(imp);
  });
});

export const extendsDirective = seq(
  "#extends",
  seq(extendsElemPhrase.tag("extends"), eolf)
).map((r) => {
  r.tags.extends[0].map((ext) => {
    ext.start = r.start; // use start of #extends, not import phrase
    r.app.state.push(ext);
  });
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
  const e = makeElem("export", r, ["args", "importing"]);
  r.app.state.push(e);
});

const moduleDirective = oneArgDirective("module");

const templateDirective = oneArgDirective("template");

function oneArgDirective<T extends NamedElem>(
  elemKind: T["kind"]
): Parser<void, TagRecord> {
  return seq(
    or(`#${elemKind}`, elemKind),
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
    fromClause,
    importClause,
    importList,
    bracketedImportClause,
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

function copyDefinedProps<S extends Record<string, any>>(
  src: S,
  keys: (keyof S)[],
  dest: any
): void {
  keys.forEach((k) => {
    if (src[k] !== undefined) dest[k] = src[k];
  });
}
