import { Token, escapeRegex, tokenMatcher } from "./TokenMatcher.js";

const symbolSet =
  "& && -> @ / ! [ ] { } : , = == != > >= >> < << <= % - --" +
  ". + ++ | || () ; * ~ ^ += -= *= /= %= &= |= ^= >>= <<= <<";

const symbolList = symbolSet.split(" ").sort((a, b) => b.length - a.length);
const escaped = symbolList.map(escapeRegex);
export const symbol = new RegExp(escaped.join("|"));

export interface Lexer {
  next(): Token | undefined;
}

const directive = /#[a-zA-Z_][a-zA-Z0-9_]+/;
const mainMatch = tokenMatcher({
  lineComment: "//",
  commentStart: "/*",
  commentEnd: "*/",
  directive,
  annotation: /@[a-zA-Z_][a-zA-Z0-9_]+/,
  word: /[a-zA-Z_][a-zA-Z0-9_]+/,
  ws: /\s+/,
});

const notDirective = /[^#]+$/;
const eol = /$/;

const line = tokenMatcher({
  directive,
  notDirective,
  eol
});

export function lex(src: string): Lexer {
  mainMatch.start(src);

  function next(): Token | undefined {
    let token = mainMatch.next();
    while (token?.kind === "ws") {
      token = mainMatch.next();
    }
    return token;
  }

  // TODO parse differently inside a comment
  return { next };
}

export function regexOr(flags: string, ...exp: RegExp[]): RegExp {
  const concat = exp.map((e) => e.source).join("|");
  return new RegExp(concat, flags);
}

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