import { matchOneOf, tokenMatcher } from "mini-parse";

/** token matchers for wgsl with #directives */

export const eol = /\n/;
export const directive = /#[a-zA-Z_]\w*/;
export const notDirective = /[^#\n]+/;

const symbolSet =
  "& && -> @ / ! [ ] { } : , = == != > >= < << <= % - -- " + // '>>' elided for template parsing, e.g. vec2<vec2<u8>>
  ". + ++ | || ( ) ; * ~ ^ // /* */ += -= *= /= %= &= |= ^= >>= <<= <<";
const symbol = matchOneOf(symbolSet);

/** matching tokens at wgsl root level */
export const mainTokens = tokenMatcher(
  {
    directive,
    attr: /@[a-zA-Z_]\w*/,
    word: /[a-zA-Z_]\w*/, // LATER consider making this 'ident' per wgsl spec (incl. non-ascii)   word,
    digits: /(?:0x)?[\d.]+[iuf]?/, // LATER parse more wgsl number variants
    symbol,
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

/** matching tokens at the start of a '//' line comment that might contain #directives */
export const lineCommentTokens = tokenMatcher(
  {
    directive,
    ws: /[ \t]+/, // note ws must be before notDirective
    notDirective,
    eol,
  },
  "lineComment"
);

/** matching tokens while parsing directive parameters #export foo(param1, param2) */
export const argsTokens = tokenMatcher(
  {
    directive,
    relPath: /[.][/\w._-]+/,
    arg: /[\w._-]+/,
    symbol,
    ws: /[ \t]+/, // don't include \n, so we can find eol separately
    eol,
  },
  "argsTokens"
);
