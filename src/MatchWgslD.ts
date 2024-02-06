import { matchOneOf, tokenMatcher } from "./TokenMatcher.js";

/** token matchers for wgsl with #directives */

const eol = /\n/;
const directive = /#[a-zA-Z_]\w*/;
const symbolSet =
  "& && -> @ / ! [ ] { } : , = == != > >= < << <= % - -- " + // '>>' elided for template parsing, e.g. vec2<vec2<u8>>
  ". + ++ | || ( ) ; * ~ ^ // /* */ += -= *= /= %= &= |= ^= >>= <<= <<";
const symbol = matchOneOf(symbolSet);

/** matching tokens at wgsl root level */
export const mainTokens = tokenMatcher(
  {
    directive,
    attr: /@[a-zA-Z_]\w*/,
    word: /[a-zA-Z_]\w*/, // consider making this 'ident' per wgsl spec (incl. non-ascii)   word,
    digits: /\d+/, // TODO do we need this?
    symbol,
    ws: /\s+/
  },
  "main"
);

export const moduleTokens = tokenMatcher(
  {
    ws: /\s+/,
    moduleName: /[a-zA-Z_][\w./-]*/
  },
  "moduleName"
);

/** matching tokens at the start of a '//' line comment that might contain #directives */
export const lineCommentTokens = tokenMatcher(
  {
    directive,
    ws: /[ \t]+/, // note ws must be before notDirective
    notDirective: /[^#\n]+/,
    eol
  },
  "lineComment"
);

/** matching tokens while parsing directive parameters #export foo(param1, param2) */
export const argsTokens = tokenMatcher(
  {
    directive,
    arg: /[\w._-]+/,
    symbol, 
    ws: /[ \t]+/, // don't include \n, so we can find eol separately
    eol
  },
  "argsTokens"
);
