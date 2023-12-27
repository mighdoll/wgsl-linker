import { tokenMatcher } from "./TokenMatcher.js";

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
const word = /[a-zA-Z_][a-zA-Z0-9_]+/;
const ws = /\s+/;
const lineComment = "//";
const digits = /[0-9]+/;

/** matching tokens at wgsl root level */
export const mainMatch = tokenMatcher({
  ...directives,
  lineComment,
  commentStart: "/*",
  commentEnd: "*/",
  annotation: /@[a-zA-Z_][a-zA-Z0-9_]+/,
  word,
  ws,
});

const notDirective = /[^#]+$/;
const eol = /$/;

/** matching tokens at the start of a '//' line comment */
export const lineCommentMatch = tokenMatcher({
  ...directives,
  notDirective,
  eol,
});
const lparen = "(";
const rparen = ")";
const comma = ",";
const equals = "=";

/** matching tokens while parsing directive parameters #export foo(param1, param2) */
export const directiveArgsMatch = tokenMatcher({
  lparen,
  rparen,
  from: "from",
  as: "as",
  word,
  digits,
  ws,
  comma,
  equals,
  eol,
});

// const symbolSet =
//   "& && -> @ / ! [ ] { } : , = == != > >= >> < << <= % - --" +
//   ". + ++ | || () ; * ~ ^ += -= *= /= %= &= |= ^= >>= <<= <<";

// const symbolList = symbolSet.split(" ").sort((a, b) => b.length - a.length);
// const escaped = symbolList.map(escapeRegex);
// export const symbol = new RegExp(escaped.join("|"));

// export function regexOr(flags: string, ...exp: RegExp[]): RegExp {
//   const concat = exp.map((e) => e.source).join("|");
//   return new RegExp(concat, flags);
// }
