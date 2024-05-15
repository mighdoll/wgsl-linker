[Mini-Parse]: https://npmjs.com/package/mini-parse
### Tagged Parser Combinators

The idea is to allow tagging elements in a grammar
so that users can reliably extract particular elements from a parse tree, 
even a deeply nested parse tree.


### Parser combinators

Parser combinators allow defining a grammar using
a library of functions and methods in the host language.
Here's a small example.
Say we want to parse function declarations like this: `fn foo()`. 
With a parser combinator library like [mini-parse], 
you can define the grammar to parse simple function declarations as follows:

```ts
const fnDecl = seq('fn', ident, '(', ')' );
```

Here `seq` is a parser combinator function provided by the library. 
`seq` returns a new parser that sequentially runs a series of provided parsers.
`seq` handles string arguments by converting them into into parsers that match
the provided string. 
So `fnDecl` is a parser that matches a string "fn" followed by
an identifier, followed by a "(", followed by a ")".

Here's a complete example. Runnable version [TODO].

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

// extract identifier from parsed result
if (result) {
  const foundIdent = result.value[1]; // magic number #1
  console.log(`found fn name: ${foundIdent}`);
}
```

### Dangerous extraction

But extracting the identifier by indexing to position
1 in the results isn't so great from a maintenance point of view. 
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
add any elements to the source language. 

Or we might want to extract multiple similar values, from multiple places
in the parsed results, futher complicating our value extraction.

Indexing into the results works, but it's fragile. 
And the maintenance risk grows if the language we're parsing
evolves over time.

Let's fix that.

### Tagging results

Instead of indexing into results, 
let's add a `tag` feature to the combinator library 
to identify the results we care about.

It'll look like this.
```
  const annotation = repeat(seq("@", ident).tag("annotated"));         // tag annotations
  const fnDecl = seq(annotation, "fn", ident.tag("fnName"), "(", ")"); // tag fnName
```

Then we can collect the results by name, rather than by index. 

While we're arranging for tagging, we'll have have the tagged values accumulate 
into an array so we can collect multiple matches. 
e.g. maybe there are multiple annotations in this case.

To make it more useful we'll have the tagged values propogate up the
and parse tree for easy collection.

In this case, the potentially multiple annotations are collected into an array in
the annotation parser under the tag "annotated". 
The annotated tag results also propogate to the parent fnDecl parser too.

```
    const [fnName] = result.tags.fnName; 
    const annotations: string[] = result.tags.annotated;
```

Tagging helps make extracting values from the parser more convenient and 
maintainable. 
No magic numbers, no maintenance problems when updating the grammar.

### Typing Tagged Results
We could have a general type of `Record<string, any[]>` for the result tags. 
That works ok, but we can do better.

It'll be more useful to the user of the library if TypeScript 
undersands that our tags for particular parsers. 
e.g. for `fnParser` the tags should be typed: `{ fnName: string[]; annotated: string[] }`. 
If TypeScript understands the tags, autocomplete in the editor will be smart,
and the compiler will catch typos in the tag names, 
mistakes in object types, etc.

Good types for tags requires some tricky work with 
the TypeScript type system. 

The basic idea is that every parser will have two type parameters, 
one for a result of its parse, and one for the accumulated tags.

Something like this:
```ts
export type TagRecord = Record<string | symbol, any[]>; 
class Parser<V, T extends TagRecord> { }
```

Parser gets a `tag` method that takes a string and returns a new parser:
```ts
class Parser<V, T extends TagRecord> { 
  tag( tagName: string ): Parser<V, ???>
}
```

And combinators will that compose parsers, will compose the TagRecord types too.
```ts
function seq(...parsers: Parser<any, any>[] ): Parser<???, ???> {}
```

The TypeScript challenge is to fill in those `???` types. 
Read here 