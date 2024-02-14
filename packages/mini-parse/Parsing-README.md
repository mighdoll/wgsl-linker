**MiniParse** is a small Typescript parser combinator library with an efficient regex based lexer.

## Parser Features

- Small code size makes **MiniParse** suitable for runtime embedding (< 5KB compressed).
- **MiniParse** is a combinator library.
  You write a grammar by combining simple TypeScript
  functions like `or()`, `repeat()`, and `seq()`.
  It's just Typescript so it's easy to mix with your existing code,
  IDE, test frameworks, etc.
- **MiniParse** is a Parsing Expression Grammar (PEG) parser.
  It parses top down, using recursive descent with backtracking.
  Top down parsing is easy to understand.
- Parsers are modular - every grammar fragment is also a parser and can be tested and reused independently.
- Extensive debug tracing for use while developing grammars is built in.
  (Tracing is automatically removed from production builds).
- Error reporting is included, with full line context displayed.

## Advanced Features

- Swap lexers under parser control. This is handy for parsing quotes,
  or for mixed language parsing (e.g. html in jsx).
- Stack parsers to parse things that can appear almost anywhere in your grammar.
  Handy for things like nested comments, semantic comments (jsdoc), or annotations.
- Named accumulators make it easy to collect parsing results from deeply nested sub parsers.

## Choosing a Parsing Approach

Consider which category of parser you'd like.

#### Custom parser code - maximum speed and ultimate malleability, but lots of work.

For maximum speed and control, write a dedicated parser directly in Typescript.
This is the most effort, but if you're writing a production compiler and need to squeeze
every millisecond, it's worth it.
Otherwise use a parser generator tool suite or a parser combinator library.

#### Parser Generators - high speed, some work to adopt.

Parser generators statically analyze and precompile a grammar description language.
These mature tools can be a bit big, but there's lots of documentation,
rich ecosystems of example code and support tools.

Worthy examples include:
[Nearley](https://nearley.js.org/),
[Lezer](https://lezer.codemirror.net/),
[Antlr](https://www.antlr.org/),
or perhaps [Ohm](https://ohmjs.org/).
Each parser generator has its own textual format to describe the grammar. The library
compiles into an execution format before parsing.
Each of the above libraries uses a different base algorithm (Earley, GLR, LL, Packrat)
with different tradeoffs, but all have evolved robust features to classic parsing
problems of error recovery, left recursion, producing parse results, tracing, etc.

Parser generators are typically more complicated to adopt than parser combinator libraries,
less flexible, require a separate build step, and they're more code than typical parser combinators.
But for demanding parsing jobs, the complexity of a parser generator tool is
easily worth the investment.

#### Parser Combinators - most flexiblity, lightweight adoption.

Parser combinators define a grammar by mixing simple TypeScript functions
provided by the library or written by the user (aka combinator functions).
Execution of the grammar involves simply running these functions.
The simplicity makes parser combinators flexible and easy to adopt - you're using
TypesScript for everything.

Parser combinators are intepreting rather than compiling the grammar in advance,
so they're slower to run. But they're plenty fast enough for most purposes.

In the Parser Combinator category, **MiniParse** has a few interesting features
and is notably lightweight.
As you're parser shopping, also consider other worthy and more mature libraries
in the TypeScript parser combinator category like:
[ts-parsec](https://github.com/microsoft/ts-parsec)
and [ParJS](https://github.com/GregRos/parjs).

## Parsing

Typically you can write a parser by mixing combinator functions from the library.

Here's a parser for a simple sum expression:

```ts
export const simpleSum = seq(num, or("+", "-"), num);
```

Here's a parser for nested block comments:

```ts
export const blockComment: Parser<void> = seq(
  "/*",
  repeat(or(() => blockComment, anyNot("*/"))),
  req("*/")
);
```

The example above uses the combinators:
`seq()`, `repeat()`, `or()`, `anyNot()`, and `req()`
More combinators are available and documented in [ParserCombinator.ts](./src/ParserCombinator.ts)

## Lexer

Parsing relies on a lexer to divide the source string into parts, called tokens.
(You could produce a token per character, but that would be comparatively slow)

Here's an example token matcher to identify three kinds of tokens for a parsing
simple arithmetic expressions.

```ts
export const simpleTokens = tokenMatcher({
  number: /\d+/,
  symbol: matchOneOf("( ) ^ + - * /"),
  ws: /\s+/,
});
```

To create a lexer that walks over a source text producing tokens, use:

```
const text = "3 + 4";
const lexer = matchingLexer(text, simpleTokens);
```

# Parsing and Collecting Results

To run a parser, give it a lexer

```ts
const result = simpleSum.parse({ lexer });
```

The result will by default be the combined results of the parser stages, in this case `["3", "+", "4"]`.

But it's useful to process the results and return only what you need using the `.map`.

```
// return a number, rather than a string
const int = num.map((r) => parseInt(r.value));

// return the numeric sum, rather than a sequence of strings
export const sumResults = seq(int, or("+", "-"), int).map((r) => {
  const [a, op, b] = r.value;
  return op === "+" ? a + b : a - b;
});
```

Commonly, you might record

## Debug Tracing

## Tricks

### Combinator Arguments and Syntax

You typically pass other parsers as arguments to combinators:

- another parser
- a function that returns a parser - uses the returned parser, but calls the function lazily
- a string - converted to a parser that accepts any token exactly matching the text

### Skip Whitespace

By default, the lexer will skip over whitespace tokens, tokens named "ws".
You can configure whether and which tokens to skip dynamically.

### Named Results

For complicated nested or repeating parsers,
it's convenient to assign names to particular results of interest.
You can use a `Symbol` or a string to name a result using the `.named()` 
method on all parsers.
Mulitple results with the same name are accumulated into an array.

```ts
const op = or("+", "-");

export const namedSum = seq(
  int,
  repeat(seq(op, int).named("opRights")) // accumulate an array of [op, int] pairs
).map((r) => {
  const { opRights } = r.named;
  const left = r.value[0];
  if (!opRights) return left;
  return opRights.reduce((acc, opRight) => {
    const [op, right] = opRight;
    return op === "+" ? acc + right : acc - right;
  }, left);
});
```

### tokens combinator
Sometimes it's nice to let the grammar choose a different tokenizer 
to parse different sections of the source text. 
For example, to parse a programming langauge with quotes, 
it's desirable to produce different tokens.

```ts
const quote = seq('"', tokens(quoteTokens, repeat(nonQuote)), '"')
```


### .toParser

In unusual cases, it can be handy to choose the next parser based
on information outside the grammar itself.
For example, to handle an `#ifdef` style preprocessor, the parsing
proceeds diferrently depending on whether the `#ifdef` is true or false,
and information outside the source text may be required to decide.
If you want to check a runtime dictionary to decide which parser to
use for the next tokens, than `.toParser` is of use.

### preParse

If the language you're parsing has some elements that can appear almost anywhere,
it'd be awkward to mention those elements at every possible position in the grammar.
Examples include nested block comments, comments containing semantic info, etc.

To handle pervasive elements, **MiniParse** offers an unusual feature called preparsing
that allows you to stack parsers. First the pre-parser will run, 
and if it fails to match at the current position, then the main parser will run.

```ts
const p = preParse(blockComments, mainParser);
```


Mulitple preparsers can be attached. Preparsing can also be temporarily disabled
in the grammar, e.g. to disable comment skipping inside quotes.

But save preparsing for special situations.
If the pervasive elements are easy to find and can be skipped, 
then adding a few token types to skip in the lexer is simpler and faster.
That's typically the approach for white space.  

### App State and Context



## Examples

Calculator parser -

Calculator parser with inline results.

WGSL-D parser.

## Left recursion

Left recursive rules are typically disallowed in top down parsers, including MiniParse.
In the parser combinator setting, it's obvious why - a function calling itself
in its first statement is going to recurse forever.
Best to write the grammar so that recursion is in the middle or at the end.
See the block comment example or the calculator example.

## Future Work

PEG parsers like MiniParse can be sped up using a memoization algorithm called packrat parsing.

[Tratt](https://tratt.net/laurie/research/pubs/html/tratt__direct_left_recursive_parsing_expression_grammars/)
describes a technique to allow some left recursive rules, based on
[Warth](https://tinlizzie.org/VPRIPapers/tr2007002_packrat.pdf)'s proposal for left recursion
with packrat parsing.
[Rossum](https://medium.com/@gvanrossum_83706/left-recursive-peg-grammars-65dab3c580e1) also
has pursued this approach for Python.
But per Tratt, note that the resulting parse order is not as predictable, and there
are issues with rules that are simultaneously left and right recursive.

Regex as a parser argument to avoid the need for a separate lexer in some cases.
