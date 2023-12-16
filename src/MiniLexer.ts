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

export interface Lexer {
  next(): Token | undefined;
  peek(): Token | undefined;
  pushMatcher(newMatcher: TokenMatcher): void;
  popMatcher(): void;
}

export function lex(src: string): Lexer {
  const matcherStack: TokenMatcher[] = [];
  let matcher = mainMatch;
  const peeked: (Token | undefined)[] = [];

  matcher.start(src);

  function next(): Token | undefined {
    if (peeked.length > 0) {
      return peeked.shift();
    } else {
      let token = matcher.next();
      while (token?.kind === "ws") {
        token = matcher.next();
      }
      return token;
    }
  }

  function peek(): Token | undefined {
    if (peeked.length === 0) {
      peeked.push(next());
    }
    return peeked[0];
  }

  function pushMatcher(newMatcher: TokenMatcher): void {
    const position = matcher.position();
    matcherStack.push(matcher);
    newMatcher.start(src, position);
    matcher = newMatcher;
  }

  function popMatcher(): void {
    const position = matcher.position();
    matcher = matcherStack.pop() || (console.error("too many pops"), mainMatch);
    matcher.start(src, position);
  }

  return { next, peek, pushMatcher, popMatcher };
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