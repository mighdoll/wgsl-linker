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
let's add a `tag` feature to the combinator library to make it easier
to identify the results we care about.

```
  const annotation = repeat(seq("@", ident).tag("annotated"));        // tag annotations
  const fnDecl = seq(annotation, "fn", ident.tag("fnName"), "(", ")"); // tag fnName
```

Then we can collect the results by name, rather than by index. 
No magic numbers, no maintenance problems when rearranging the grammar.

While we're arranging for tagging, we'll have have the tagged values accumulate 
into an array so we can collect multiples matches. 
And we'll have the tagged values propogate up the
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

We could have a type of `Record<string, any[]>` for the result tags. 
That'll work.  

But to make things really work well for the user, 
we want to TypeScript to understand the tags.  
If TypeScript understands the tags, autocomplete in the editor will be smart,
and the compiler will catch typos in the tag names, 
mistakes in object types, etc.

### TypeScript Types for tagged results

Our goal is to be able to tag and accumulate results with TypeScript
typing for the tags.

Let's define a `TaggedResult` class containing a result and a tag record
containing named results.

We're going to want to fill in the `TBD` types.

```
  type TagRecord = Record<string, any[]>;

  class TaggedResult<T, N extends TagRecord> {
    constructor(value:T) { }
    get result(): T { }
    get tags(): N { }

    /** return a new TaggedResult with tag name attached to the result */
    tag(name: string): TaggedResult<T, TBD> { }
  }

  /** combine results into an array sequence and merge tag records */
  function seq(...taggedResultOrString: TBD[]): TaggedResult<TBD, TBD> {}
```

If it 



#### Infer type parameters with specifing them
#### Intersecting types
#### Conditional types 
#### Encouraging keyed records
#### Mapped tuple types