import {
  ExportElem,
  ImportElem,
  StructElem,
  CallElem,
  FnElem,
  AbstractElem,
} from "./AbstractElems.js";
import { matchingLexer } from "./MatchingLexer.js";
import {
  directiveArgsTokens,
  lineCommentTokens,
  mainTokens,
} from "./MatchWgslD.js";
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
  tokens,
} from "./ParserCombinator.js";

/** parser that recognizes key parts of WGSL and also directives like #import */

const m = mainTokens;
const a = directiveArgsTokens;
const l = lineCommentTokens;

const directiveArgs = seq(
  "(",
  kind(a.word).named("word"),
  repeat(seq(",", kind(a.word).named("word"))),
  ")"
)
  .map((r) => r.named.word)
  .traceName("directiveArgs");

const eol = or("\n", eof());

/** #export <foo> <(a,b)> EOL */
const exportDirective = seq(
  "#export",
  tokens(
    directiveArgsTokens,
    seq(opt(kind(a.word).named("name")), opt(directiveArgs.named("args")), eol)
  )
)
  .map((r) => {
    const e = makeElem<ExportElem>("export", r, ["name"], ["args"]);
    r.app.push(e);
  })
  .traceName("export");

/** #import foo <(a,b)> <from bar> <as boo> EOL */
const importDirective = seq(
  "#import",
  tokens(
    directiveArgsTokens,
    seq(
      kind(a.word).named("name"),
      opt(directiveArgs.named("args")),
      opt(seq("as", kind(a.word).named("as"))),
      opt(seq("from", kind(a.word).named("from"))),
      eol
    )
  )
)
  .map((r) => {
    const named: (keyof ImportElem)[] = ["name", "from", "as"];
    const e = makeElem<ImportElem>("import", r, named, ["args"]);
    r.app.push(e);
  })
  .traceName("import");

const ifDirective: ParserStage<any> = seq(
  "#if",
  tokens(
    directiveArgsTokens,
    seq(opt("!").named("invert"), kind(m.word).named("name"), eol)
  ).toParser((r) => {
    const { params } = r.appState as ParseState;
    const ifArg = r.named["name"]?.[0] as string;
    const invert = r.named["invert"]?.[0] === "!";
    const arg = !!params[ifArg];
    const truthy = invert ? !arg : arg;
    return ifBody(r, truthy);
  })
).traceName("#if");

const elseDirective = seq("#else", tokens(directiveArgsTokens, eol))
  .toParser((r) => {
    const { ifStack } = r.appState as ParseState;
    const ifState = ifStack.pop();
    if (ifState === undefined) console.warn("unmatched #else", r.start);
    return ifBody(r, !ifState);
  })
  .traceName("#else");

function ifBody(
  r: ExtendedResult<any>,
  truthy: boolean
): ParserStage<any> | undefined {
  const { ifStack } = r.appState as ParseState;
  ifStack.push(truthy);
  if (!truthy) return skipUntilElseEndif;
}

const endifDirective = seq("#endif", tokens(directiveArgsTokens, eol))
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
).traceName("directive or");
// .trace();

/** // <#import|#export|any> */
export const lineComment = seq(
  "//",
  tokens(lineCommentTokens, or(directive, kind(l.notDirective)))
).traceName("lineComment");

// prettier-ignore
const skipUntilElseEndif = repeat(
  seq(
    or(
      lineComment, 
      seq(
        not("#else"), 
        not("#endif"),
        any()
      ), 
    )
  )
).traceName("skipTo #else/#endif");

const structDecl = seq(
  "struct",
  kind(m.word),
  "{",
  repeat(or(lineComment, seq(not("}"), any()))),
  "}"
).map((r) => {
  const e = makeElem<StructElem>("struct", r, ["name"]);
  r.app.push(e);
});

export const fnCall = seq(
  kind(m.word)
    .named("call")
    .map((r) => makeElem<CallElem>("call", r, ["call"]))
    .named("calls"), // we collect this in fnDecl, to attach to FnElem
  "("
);

const block: ParserStage<any> = seq(
  "{",
  repeat(
    or(
      lineComment,
      fnCall,
      fn(() => block),
      seq(not("}"), any())
    )
  ),
  "}"
).traceName("block");

export const fnDecl = seq(
  "fn",
  kind(a.word).named("name"),
  "(",
  repeat(or(lineComment, seq(not("{"), any()))),
  block
)
  .traceName("fnDecl")
  .map((r) => {
    const fn = makeElem<FnElem>("fn", r, ["name"]);
    fn.children = r.named.calls || [];
    r.app.push(fn);
  });

const unknown = any().map((r) => console.warn("???", r.value, r.start));

const rootDecl = or(fnDecl, directive, structDecl, lineComment, unknown);

const root = seq(repeat(rootDecl), eof());

interface ParseState {
  ifStack: boolean[];
  params: Record<string, any>;
}

export function parseMiniWgsl(
  src: string,
  params: Record<string, any> = {}
): AbstractElem[] {
  const lexer = matchingLexer(src, mainTokens);
  const app: AbstractElem[] = [];

  const appState: ParseState = { ifStack: [], params };
  const context: ParserContext = { lexer, app, appState: appState };

  root(context);

  return context.app;
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
