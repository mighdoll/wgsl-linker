import { matchingLexer } from "./MatchingLexer.js";
import {
  directiveArgsTokens,
  lineCommentTokens,
  mainTokens,
} from "./MiniWgslMatch.js";
import {
  ExtendedResult,
  ParserContext,
  ParserStage,
  any,
  eof,
  fn,
  kind,
  not,
  opt,
  or,
  repeat,
  seq,
  tokens
} from "./ParserCombinator.js";

export type AbstractElem =
  | ImportElem
  | ExportElem
  | FnElem
  | CallElem
  | StructElem;

/** 'interesting' elements found in the source */
export interface AbstractElemBase {
  kind: string;
  start: number;
  end: number;
}

export interface CallElem extends AbstractElemBase {
  kind: "call";
  call: string;
}

export interface FnElem extends AbstractElemBase {
  kind: "fn";
  name: string;
  children: (ImportElem | CallElem)[];
}

export interface StructElem extends AbstractElemBase {
  kind: "struct";
  name: string;
}

export interface ExportElem extends AbstractElemBase {
  kind: "export";
  name?: string;
  args?: string[];
}

export interface ImportElem extends AbstractElemBase {
  kind: "import";
  name: string;
  args?: string[];
  as?: string;
  from?: string;
}

const m = mainTokens;
const a = directiveArgsTokens;
const l = lineCommentTokens;

const directiveArgs = seq(
  "(",
  kind(a.word).named("word"),
  repeat(seq(",", kind(a.word).named("word"))),
  ")"
)
  .traceName("directiveArgs")
  .mapResults((r) => r.named.word);

const eol = or("\n", eof());

/** #export <foo> <(a,b)> EOL */
const exportDirective = seq(
  "#export",
  tokens(
    directiveArgsTokens,
    seq(opt(kind(a.word).named("name")), opt(directiveArgs.named("args")), eol)
  ).traceName("export")
).mapResults((r) => {
  const e = makeElem<ExportElem>("export", r, ["name"], ["args"]);
  r.results.push(e);
});

/** #import foo <(a,b)> <from bar> <as boo> EOL */
const importDirective = seq(
  "#import",
  tokens(
    directiveArgsTokens,
    seq(
      kind(a.word).named("name"),
      opt(directiveArgs.named("args")),
      opt(seq("from", kind(a.word).named("from"))),
      opt(seq("as", kind(a.word).named("as"))),
      eol
    )
  )
)
  .traceName("import")
  .mapResults((r) => {
    const named: (keyof ImportElem)[] = ["name", "from", "as"];
    const e = makeElem<ImportElem>("import", r, named, ["args"]);
    r.results.push(e);
  });

export const directive = or(exportDirective, importDirective);

/** // <#import|#export|any> */
export const lineComment = seq(
  "//",
  tokens(lineCommentTokens, or(directive, kind(l.notDirective)))
);

const structDecl = seq(
  "struct",
  kind(m.word),
  "{",
  repeat(or(lineComment, not("}"))),
  "}"
).mapResults((r) => {
  const e = makeElem<StructElem>("struct", r, ["name"]);
  r.results.push(e);
});

export const fnCall = seq(
  kind(m.word)
    .traceName("fn-name")
    .mapResults(({ start, end, value }) => ({ start, end, call: value }))
    .named("call"),
  "("
);

const block: ParserStage<any> = seq(
  "{",
  repeat(
    or(
      lineComment,
      fnCall,
      fn(() => block),
      not("}")
    )
  ),
  "}"
).traceName("block");

export const fnDecl = seq(
  "fn",
  kind(a.word).named("name"),
  "(",
  repeat(or(lineComment, not("{"))),
  block
)
  .traceName("fnDecl")
  .mapResults((r) => {
    const calls = r.named.call || [];
    const callElems: CallElem[] = calls.map(({ start, end, call }) => {
      return { kind: "call", start, end, call };
    });
    const fn = makeElem<FnElem>("fn", r, ["name"]);
    fn.children = callElems;
    r.results.push(fn);
  });

const unknown = any().map((t) => console.warn("???", t));
// const unknown = any();
const rootDecl = or(fnDecl, directive, structDecl, lineComment, unknown);

const root = repeat(rootDecl); // TODO check for EOF

export function parseMiniWgsl(src: string): AbstractElem[] {
  const lexer = matchingLexer(src, mainTokens);
  const app: AbstractElem[] = [];

  const state: ParserContext = { lexer, app };
  root(state);

  return state.app;
}

/** creat an AbstractElem by pulling fields from named parse results */
function makeElem<U extends AbstractElem>(
  kind: U["kind"],
  er: ExtendedResult<any>,
  named: (keyof U)[],
  namedArrays: (keyof U)[] = []
): U {
  const { start, end } = er;
  const nameds = named as string[];
  const namedSArrays = namedArrays as string[];
  const nameValues = nameds.map((n) => [n, er.named[n]?.[0]]);
  const arrayValues = namedSArrays.map((n) => [n, er.named[n]]);
  const nv = Object.fromEntries(nameValues);
  const av = Object.fromEntries(arrayValues);
  return { kind, start, end, ...nv, ...av };
}
