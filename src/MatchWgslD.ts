import { escapeRegex, tokenMatcher } from "./TokenMatcher.js";

/** token matchers for wgsl with #directives */

const directive = /#[a-zA-Z_]\w*/;
export const word = /[a-zA-Z_]\w*/; // consider making this 'ident' per wgsl spec (incl. non-ascii)
const symbolSet =
  "& && -> @ / ! [ ] { } : , = == != > >= < << <= % - -- " + // '>>' elided for template parsing, e.g. vec2<vec2<u8>>
  ". + ++ | || ( ) ; * ~ ^ // /* */ += -= *= /= %= &= |= ^= >>= <<= <<";

/** @return a regexp to match any of the space separated tokens in the provided string.
 *
 * regex special characters are escaped in strings are escaped, and the matchers
 * are sorted by length so that longer matches are preferred.
 */
function matchOneOf(syms: string): RegExp {
  const symbolList = syms.split(" ").sort((a, b) => b.length - a.length);
  const escaped = symbolList.map(escapeRegex);
  return new RegExp(escaped.join("|"));
}

const digits = /[0-9]+/;

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

export const moduleTokens = tokenMatcher(
  {
    ws: /\s+/,
    moduleName: /[a-zA-Z_][\w./-]*/,
  },
  "moduleName"
);

const eol = /\n/;

/** matching tokens at the start of a '//' line comment that might contain #directives */
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
    arg: /[\w\d._-]+/,
    symbol: matchOneOf("( ) , = !"),
    ws: /[ \t]+/, // don't include \n, so we can find eol separately
    eol,
  },
  "argsTokens"
);
