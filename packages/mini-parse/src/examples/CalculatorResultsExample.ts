import { Parser, setTraceName } from "../Parser.js";
import { fn, opt, or, repeat, seq } from "../ParserCombinator.js";
import { tracing } from "../ParserTracing.js";
import { mulDiv, num, plusMinus } from "./CalculatorExample.js";

let expr: Parser<any> = null as any; // help TS with forward reference

/* from: https://en.wikipedia.org/wiki/Parsing_expression_grammar#Example 
    Expr    ← Sum
    Sum     ← Product (('+' / '-') Product)*
    Product ← Power (('*' / '/') Power)*
    Power   ← Value ('^' Power)?
    Value   ← [0-9]+ / '(' Expr ')'
*/

const value = or(
  num.map((r) => parseInt(r.value)).named("value"),
  seq(
    "(",
    fn(() => expr.named("value")),
    ")"
  )
).map((r) => r.named.value[0]);

export const power = seq(
  value.named("base"),
  opt(seq("^", value.named("exp"))) // TODO power
).map((r) => {
  const { base, exp } = r.named;
  return exp ? base[0] ** exp[0] : base[0];
});

export const product = seq(
  power.named("pow"),
  repeat(seq(mulDiv, power).named("mulDiv"))
).map((r) => {
  const { pow, mulDiv } = r.named;
  if (!mulDiv) return pow[0];
  const result = mulDiv.reduce((acc, opVal) => {
    const [op, val] = opVal;
    return op === "*" ? (acc *= val) : (acc /= val);
  }, pow[0]);
  return result;
});

export const sum = seq(
  product.named("left"),
  repeat(seq(plusMinus, product).named("sumOp"))
).map((r) => {
  const { left, sumOp } = r.named;
  if (!sumOp) return left[0];
  return sumOp.reduce((acc, opVal) => {
    const [op, val] = opVal;
    return op === "+" ? (acc += val) : (acc -= val);
  }, left[0]);
});
/* */ expr     = sum; // prettier-ignore

export const statement2 = expr as Parser<number>;

if (tracing) {
  const names: Record<string, Parser<unknown>> = {
    value,
    power,
    product,
    sum,
    expr
  };

  Object.entries(names).forEach(([name, parser]) => {
    setTraceName(parser, name);
  });
}
