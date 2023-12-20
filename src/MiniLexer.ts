import { tokenMatcher } from "./TokenMatcher.js";

/** token matchers for parrts of wgsl and #directives */
/*
syntax we aim to parse:

#import name (arg1, arg2) from moduleName as rename
#export (arg1, arg2)
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

const directive = /#[a-zA-Z_][a-zA-Z0-9_]+/;
const word = /[a-zA-Z_][a-zA-Z0-9_]+/;
const ws = /\s+/;

/** matching tokens at wgsl root level */
export const mainMatch = tokenMatcher({
  lineComment: "//",
  commentStart: "/*",
  commentEnd: "*/",
  directive,
  annotation: /@[a-zA-Z_][a-zA-Z0-9_]+/,
  word,
  ws,
});

const notDirective = /[^#]+$/;
const eol = /$/;

/** matching tokens within '//' line comment */
export const lineCommentMatch = tokenMatcher({
  directive,
  notDirective,
  eol,
});
const lparen = "(";
const rparen = ")";
const comma = ",";
const equals = "=";

/** matching tokens while parsing directive parameters #export foo(param1, param2) */
export const directiveArgsMatch = tokenMatcher({
  word,
  ws,
  lparen,
  rparen,
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
