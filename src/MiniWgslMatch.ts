import { escapeRegex, tokenMatcher } from "./TokenMatcher.js";

/** token matchers for parrts of wgsl and #directives */
/*
syntax we aim to parse:

#import name <(arg1, arg2)> <from moduleName> <as rename>
#export <name> <(arg1, arg2)>
#replace 128=workgroupSize 
// 
/* * /

fn decl() 
struct decl { }

fnCall()
StructConstruct()
: StructType
<Struct, ...>  
*/

const exportD = "#export";
const importD = "#import";
const directives = { exportD, importD };
const word = /[a-zA-Z_][a-zA-Z0-9_]*/;
const ws = /\s+/;
const lineComment = "//";
const digits = /[0-9]+/;
const lparen = "(";
const rparen = ")";
const comma = ",";
const equals = "=";
const symbolSet =
  "& && -> @ / ! [ ] { } : , = == != > >= >> < << <= % - --" +
  ". + ++ | || ( ) ; * ~ ^ /* */ += -= *= /= %= &= |= ^= >>= <<= <<";

function makeSymbols(syms: string): RegExp {
  const symbolList = syms.split(" ").sort((a, b) => b.length - a.length);
  const escaped = symbolList.map(escapeRegex);
  return new RegExp(escaped.join("|"));
}

/** matching tokens at wgsl root level */
export const mainTokens = tokenMatcher(
  {
    ...directives,
    lineComment,
    annotation: /@[a-zA-Z_][a-zA-Z0-9_]*/,
    word,
    symbol: makeSymbols(symbolSet),
    ws,
  },
  "main"
);

const eol = /\n/;

/** matching tokens at the start of a '//' line comment */
export const lineCommentTokens = tokenMatcher(
  {
    ...directives,
    ws: /[ \t]+/,
    notDirective: /[^#\n]+/,
    eol,
  },
  "lineComment"
);

/** matching tokens while parsing directive parameters #export foo(param1, param2) */
export const directiveArgsTokens = tokenMatcher(
  {
    lparen,
    rparen,
    from: "from",
    as: "as",
    word,
    digits,
    comma,
    equals,
    eol,
    ws: /[ \t]+/,
  },
  "directiveArgs"
);
