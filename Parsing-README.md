**MiniParse** is a small Typescript parser combinator library with an efficient regex based lexer.

## Basic Features
* Small code size makes **MiniParse** suitable for runtime embedding (< 5KB compressed).
* **MiniParse** parses top down, using recursive descent with backtracking. 
Top down parsing is easy to understand. 
* No separate build step is required, write a grammar by combining simple javascript/typescript 
functions like `or()`, `repeat()`, and `seq()`.
* Extensive debug tracing for developing grammars is built in
(and automatically removed from production builds).
* Error reporting with line context.
* Modular parsers - every grammar fragment is also a parser and can be tested and reused independently.

## Unusual Features
* Swap lexers under parser control. This is handy for parsing quotes, 
  or for mixed language parsing (e.g. html in jsx).
* Stack parsers to handle pervasive insertions, for things like nested comments,
  semantic comments (jsdoc), or annotations. 
* Named accumulators make it easily collect parsing results from deeply nested sub parsers.

## Choosing a Parsing Approach in the Javascript Ecosystem
* For maximum speed and flexiblity, write a dedicated parser directly in Typescript.
This is the most effort, but if you're writing a production compiler and need to squeeze
every millisecond, it's worth it. Otherwise use a parser generator tool suite or 
a parser combinator library.

* For high parsing speed, and rich ecosystems of example code and support tools, consider
using a mature parser generator based tool suite like 
[Nearley](https://nearley.js.org/), 
[Lezer](https://lezer.codemirror.net/), 
or [Antlr](https://www.antlr.org/). 
Parser generators are more complicated to adopt than parser combinator libraries, 
less modular and flexible, and typically larger.
For more demanding parsing jobs, the complexity of a parser generator tool is 
easily worth the investment.

* For maximum flexibilty and lightweight adoption, consider a parser generator. 
They're typically plenty fast enough!
**MiniParse** is in this category. Other worthy parser generators currently
active in the Javascript ecosystem include 
[ts-parsec](https://github.com/microsoft/ts-parsec) 
and [ParJS](https://github.com/GregRos/parjs).

## Parsing
* 

## Lexer

## Calculator example

## Future Work