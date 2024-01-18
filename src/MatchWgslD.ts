import { escapeRegex, tokenMatcher } from "./TokenMatcher.js";

/** token matchers for wgsl with #directives */

const directive = /#[a-zA-Z_]\w*/;
const word = /[a-zA-Z_]\w*/; // consider making this 'ident' per wgsl spec (incl. non-ascii)
const symbolSet =
  "& && -> @ / ! [ ] { } : , = == != > >= >> < << <= % - -- " +
  ". + ++ | || ( ) ; * ~ ^ // /* */ += -= *= /= %= &= |= ^= >>= <<= <<";

function matchOneOf(syms: string): RegExp {
  const symbolList = syms.split(" ").sort((a, b) => b.length - a.length);
  const escaped = symbolList.map(escapeRegex);
  return new RegExp(escaped.join("|"));
}

const digits = /[0-9]+/;
// TODO consider parsing size suffixes to numbers, e.g. 10u

/** matching tokens at wgsl root level */
export const mainTokens = tokenMatcher(
  {
    directive,
    attr: /@[a-zA-Z_]\w*/,
    word,
    digits,
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
export const argsTokens = tokenMatcher(
  {
    word,
    digits,
    symbol: matchOneOf("( ) , = !"),
    ws: /[ \t]+/, // don't include \n, so we can find eol separately
    eol,
  },
  "directiveArgs"
);
