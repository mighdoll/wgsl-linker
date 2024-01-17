import { escapeRegex, tokenMatcher } from "./TokenMatcher.js";

/** token matchers for wgsl with #directives */

const directive = /#[a-zA-Z_]\w*/;
const word = /[a-zA-Z_]\w*/;
const symbolSet =
  "& && -> @ / ! [ ] { } : , = == != > >= >> < << <= % - -- " +
  ". + ++ | || ( ) ; * ~ ^ // /* */ += -= *= /= %= &= |= ^= >>= <<= <<";

function matchOneOf(syms: string): RegExp {
  const symbolList = syms.split(" ").sort((a, b) => b.length - a.length);
  const escaped = symbolList.map(escapeRegex);
  return new RegExp(escaped.join("|"));
}

/** matching tokens at wgsl root level */
export const mainTokens = tokenMatcher(
  {
    directive,
    attr: /@[a-zA-Z_]\w*/,
    word,
    symbol: matchOneOf(symbolSet),
    ws: /\s+/,
  },
  "main"
);

const eol = /\n/;

/** matching tokens at the start of a '//' line comment */
export const lineCommentTokens = tokenMatcher(
  {
    directive,
    ws: /[ \t]+/, // note ws must be before notDirective
    notDirective: /[^#\n]+/,
    eol,
  },
  "lineComment"
);

/** matching tokens while parsing directive parameters #export foo(param1, param2) */
export const directiveArgsTokens = tokenMatcher(
  {
    word,
    digits: /[0-9]+/,
    symbol: matchOneOf("( ) , = !"),
    ws: /[ \t]+/,
    eol,
  },
  "directiveArgs"
);
