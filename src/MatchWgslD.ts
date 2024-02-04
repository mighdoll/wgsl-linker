import { escapeRegex, matchOneOf, tokenMatcher } from "./TokenMatcher.js";

/** token matchers for wgsl with #directives */

const directive = /#[a-zA-Z_]\w*/;
export const word = /[a-zA-Z_]\w*/; // consider making this 'ident' per wgsl spec (incl. non-ascii)
const symbolSet =
  "& && -> @ / ! [ ] { } : , = == != > >= < << <= % - -- " + // '>>' elided for template parsing, e.g. vec2<vec2<u8>>
  ". + ++ | || ( ) ; * ~ ^ // /* */ += -= *= /= %= &= |= ^= >>= <<= <<";


/** matching tokens at wgsl root level */
export const mainTokens = tokenMatcher(
  {
    directive,
    attr: /@[a-zA-Z_]\w*/,
    word,
    digits:/\d+/, // TODO do we need this?
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
