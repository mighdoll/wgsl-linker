import { Parser, setTraceName } from "./Parser.js";
import { fn, kind, opt, or, repeat, seq } from "./ParserCombinator.js";
import { tracing } from "./ParserTracing.js";
import { matchOneOf, tokenMatcher } from "./TokenMatcher.js";

export const calcToken = tokenMatcher({
  number: /\d+/,
  ws: /\s+/,
  mulDiv: matchOneOf("* /"),
  plusMinus: matchOneOf("+ -"),
  symbol: matchOneOf("( ) ^"),
});

let expr: Parser<any> = null as any; // help TS with forward reference
const num       = kind(calcToken.number); // prettier-ignore
const plusMinus = kind(calcToken.plusMinus); // prettier-ignore
const mulDiv    = kind(calcToken.mulDiv); // prettier-ignore

/* from: https://en.wikipedia.org/wiki/Parsing_expression_grammar#Example 
    Expr    ← Sum
    Sum     ← Product (('+' / '-') Product)*
    Product ← Power (('*' / '/') Power)*
    Power   ← Value ('^' Power)?
    Value   ← [0-9]+ / '(' Expr ')'
*/

const value    = or(num, seq("(", fn(() => expr), ")")); // prettier-ignore
const power    = seq(value, opt(seq("^", value))); // prettier-ignore
const product  = seq(power, repeat(seq(plusMinus, power))); // prettier-ignore
const sum      = seq(product, seq(mulDiv, product)); // prettier-ignore
/* */ expr     = sum; // prettier-ignore

export const statement = repeat(expr)

if (tracing) {
  const names: Record<string, Parser<unknown>> = {
    value,
    power,
    product,
    sum,
    expr,
  };

  Object.entries(names).forEach(([name, parser]) => {
    setTraceName(parser, name);
  });
}
