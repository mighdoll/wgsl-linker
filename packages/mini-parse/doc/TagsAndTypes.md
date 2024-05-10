### TypeScript type gymnastics for parser combinators.

I've just added some fancy TypeScript types to a parser combinator library.
Things got a little deep with 
conditional types, mapped tuple types, contravariance, 'infer', and more.

Our goal is to create types that allow tagging elements in a grammar,
so that users can reliably extract particular elements from a parse tree, 
even a deeply nested parse tree.

Let's say we construct a parser that recognizes the parts of a function 
in a programming language source text. 
Among other things, the parser identifies all of the internal 
calls to other functions inside the parsed function body.
We'll eventually want to extract these outgoing calls from the parsed results.

So here's a parser:
```
const result = fnParser.parse(...); // parses the text of a function definition
```

We'll invent a way to 'tag' the call elements,
so we can extract the elements we care about by the 'call' tag:

```
const fnCalls: CallElem[] = result.tags.call;
```

Then we'll explore the mysteries of getting TypeScript to understand the tagged 
to enable autocomplete 
and type checking on the tagged results.


### Parser combinators

Quick refresh: parser combinators allow defining a grammar using
a library of functions and methods in the host language.
Let's take a small example. 
Say we want to parse function declarations like this: `fn foo()`. 
With a parser combinator library, you could define the grammar to parse
simple function declarations:

```ts
const fnDecl = seq('fn', ident, '(', ')' );
```

Here `seq` is a parser combinator function provided by the library. 
`seq` returns a new parser that sequentially runs a series of provided parsers.
`seq` handles string arguments by converting them into into parsers that match
the provided string. 
So `fnDecl` is a parser that matches a string "fn" followed by
an identifier, followed by a "(", followed by a ")".

Here's a complete example. Runnable version.

```ts
const src = "fn foo()";

// lexer
const tokens = tokenMatcher({
  ident: /[a-z]+/,
  ws: /\s+/,
  symbol: matchOneOf("( ) [ ] { } ; ,")
});
const lexer = matchingLexer(src, tokens);

// parsers
const ident = kind(tokens.ident);
const fnDecl = seq('fn', ident, '(', ')' );

// run parser 
const result = fnDecl.parse({lexer});

// extract identifier 
if (result) {
  const foundIdent = result.value[1]; // magic number #1
  console.log(`found fn name: ${foundIdent}`);
}
```

### Dangerous extraction

But extracting the identifier by indexing to position
1 in the results is dangerous from a maintenance point of view. 
If the grammar changes, the index will change, and our code will break.

Let's say we update the grammar to allow for optional annotations, 
to allow the possibility of something like `@export fn foo()`.
```
const annotation = opt(seq("@", ident));
const fnDecl = seq(annotation, "fn", ident, "(", ")");
```

Now the result we want is at magic number #2 and the extraction code above won't work anymore.

In a more complicated case, 
we might be looking for elements deeper in the parse tree, 
requiring us to index multiple times `result.value[1][2][0]`, and leaving
us vulnerable to restructuring of the parsers even if we don't
add any elements to the language. 

Or we might want to extract multiple similar values, from multiple places
in the parsed results, futher complicating our value extraction.

Indexing into the results works, but the maintenance risk grows if
the grammar evolves over time.

### Tagging results

Instead of indexing into results, 
let's add a feature to the combinator library to make it easier
to identify the results we care about.



### TypeScript Types for tagged results

