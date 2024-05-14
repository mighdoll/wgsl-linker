### TypeScript Types for Accumulating Results

Let's define a `TagsResult` class containing a result and a tag record.

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


## Infer a Type Without Passing it in as a Parameter

#### Explicit type parameters are staightforward
Let's say you have a type that takes several type parameters.
```ts
  interface ThreeParams<A, B, C> { a: A; b: B; c: C; }
```

In typical cases, if you had a function taking a `ThreeParams` argument
you'd take three type parameters: 
```ts
  function makeThree<A, B, C>(a: A, b: B, c: C): ThreeParams<A, B, C> {
    return { a, b, c };
  }
```

TypeScript will usually fill in the type parameters to save work for users of the api.
```ts
  const p = makeThree("foo", 1, true);
```

All good so far. Do that if it works.

#### Explicit type parameters fail for more complicated cases
But what if there are a whole lot of repeated type parameters, 
or a variable number of parameters,
or if it's hard for TypeScript to figure out the types in advance?

```ts
  // at best it's tedious to write out many functions with lots of parameters
  function foo<A, B, C, D, E, F>(
    a: ThreeParams<A, B, C>,
    b: ThreeParams<D, E, F>
  ): B { }

  // and complicated cases like variable argument lists get tricky.. 
  function fooM<A,B,C, ???>(...args: ThreeParams<???, ???, ???>[]): ??? { }

```
#### Solution: 'infer'

One way around these problems to put a simpler, less parameterized type
on the api. Then we'll use 'infer' to magically pull out the types 
we need but didn't specify as paremeters. Here's an example:

Create a type that hides the parameters from the external api:
```ts
    type Hidden = ThreeParams<any, any, any>;
```

And then we can use `infer` to figure out only the types we need on the inside.
We need a 'stage' for `infer` to work, so we introduce a conditional type.
The condition will always be true, and we'll always return the inferred type.
In this case, we're interested in the second type parameter.
```ts
  type InferParamB<T extends ThreeParams<any, any, any>> =
    T extends ThreeParams<any, infer B, any> ? B : never;
```

We'd use the new inferred type constructor like this:
```ts
  function fooB<T extends Hidden>(a: Hidden): InferParamB<Hidden> { }
```
We've reduced the visible type parameters in the API here from three to one. 
If there were more function parameters, multiple function overloads, 
or more just type parameters, the simplification of having just 

And the infer type constructor can be handy in more complicated situations too.
Here's an example with variable numbers of arguments.
This example also uses the TypeScript 
[typeof](https://www.typescriptlang.org/docs/handbook/2/typeof-types.html) operator, 
which works to give you the type of a term as long as you're in a type context,
e.g. between <>. 
We can even index to pick out the type of the first argument of the args array.

```ts
  // return type is the second type parameter of the first argument 
  function fooH<T extends Hidden>(...args: T[]): InferB<typeof args[0]> {
```

By using 'infer' we can keep things simple on the side of the api that our caller uses,
and cleanly solve some complicated type problems on the inside.


##### Note: Still Need One Type Paramter
Note that we'll typically still need one type parameter:

```ts
  // return type is second type parameter of ThreeParams
  function fooB<T extends Hidden>(a: T): InferParamB<Hidden> { }
```

No type parameters doesn't work as well, 
TypesScript leaves the internal types as `any`.
```ts
  // return type any
  function fooB_nope(a: Hidden): InferParamB<Hidden> { }
```

## Extending a Record Type Using a Mapped Type
Let's say you're collecting fields into a Record type 
and you want to add a field.

Here's an example of adding a field to record in a type safe way:

```ts
  // holds a Record
  class Tags<N extends Record<string, any>> {
    add<K extends string, V>(name: K, value:V): Tags<N & { [key in K]: V }>  { }
    read(): N { }
  }
```

Then you can use it like this.
```ts
  const tags = new Tags().add("c", true); 
  const moreTags = tags.add("bar", "zap"); // add more fields
  const record: { c: boolean; bar: string } = moreTags.read(); // properly typed result
```

There's two Typescript tricks involved in the typing of `add`. 

First, we need a way to define the record for the newly added field.
`{ [key in K]: V }` defines a mapped type, which maps over the fields
in K to create a new record type. 
[Mapped type](https://www.typescriptlang.org/docs/handbook/2/mapped-types.html) 
syntax like this is usually seen mapping over a Record type,
but it turns out you can use it for a single string too.
The `[x in U]` part of the syntax maps over a union type, 
typically created by the 
[`keyof`](https://www.typescriptlang.org/docs/handbook/2/keyof-types.html#handbook-content) 
type operator on a Record.
In this case `K` is always a single type 
but that still qualifies as a (lonely) union.

Second, we need to combine the new record type with the existing record type.
Here we use a single intersection step, 
combining the existing record type `N` with the new record type.
The resulting type `{c: boolean}` & `{bar: string}` is equivalent to
`{c: boolean; bar: string}`, 
and so we've successfully extended our Record.

## Intersecting to Build Type Safe Records
Let's say we have two Record types `{a: string}` and `{b: number}`. 
The type constructor below, `Intersection`, will combine 
the two Record types like this: `{a: string} & {b: number}`, which
is the same as `{a: string; b: number}`. 
So `Intersection` is critical for type safely constructing Record types 
from other Records.

It's typical in type manipulation to find that you have a union type.
A union of the records above would give us 
the choice of either type: `{a: string} | {b: number}`.
Sometimes we'd want the union. 
But for combining into a single Record, we'd want the intersection.

If you have a union type like `A | B | C`, 
the following type constructor will turn the union into an intersection like `A & B & C`.

```ts
export type Intersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I
) => void
  ? I
  : never;
```

 The trick is described here in the 
 [TypeScript docs](https://www.typescriptlang.org/docs/handbook/advanced-types.html#type-inference-in-conditional-types)
and here on [Stack Overflow](https://stackoverflow.com/questions/50374908/transform-union-type-to-intersection-type). 
The key move is to place the source type `U` into contravariant position
as a function parameter. Then when TypeScript infers the type 
of the function parameter, it will be the intersection of the types in the union.


#### Why Function Argument Types Intersect
Function arguments are normally contravariant -
an alternate function that takes a more general function argument would be an type
safe replacement. 
If we have a function that takes an insect and returns the number of legs, 
we could type safely substitute a function that takes any animal 
and returns the number of legs.

If we have a function that takes an argument of type: `{a:string} | {b:number}`, 
we could type safely use an alternate function 
that takes an argument of type: `{a:string, b:number}`

So if we have a function that takes an argument of type `A | B | C`,
we could type safely replace it with a function 
that takes an argument of `A & B & C`. 

## Recovering Record Key Names
Sometimes you're inferring a Record and TypeScript knows the keys and the value
types but its own inference has made things more general or lost track
of the keys..

```
export type KeyedRecord<T> = { [A in keyof T]: T[A] };
```

## Mapped Tuple Types
There's a little trick for mapping over Tuple and Array types
that isn't mentioned in the main documentation for TypeScript 
[Mapped Types](https://www.typescriptlang.org/docs/handbook/2/mapped-types.html).

Let's say you want to convert an array of strings and numbers 
to an array of objects with "str" and "num" fields.

We can convert the type of one element using a conditional type:
```ts
  type Wrapped<T extends string | number> = T extends string
    ? { str: T }
    : T extends number
      ? { num: T }
      : T;
```


Here's how we might define a function that does the wrapping:
```ts
  function wrapEm<T extends (string | number)[]>(...args: T): WrapElems<T> { }
```

And here's the type constructor that maps the array from one type to another.

```ts
  type WrapElems<T extends (string | number)[]> = 
    { [key in keyof T]: Wrapped<T[key]> };
```
* `T` is an array, and so the 
[Mapped Type](https://www.typescriptlang.org/docs/handbook/2/mapped-types.html) 
type `{ [key in keyof T]: Wrapped<T[key]> }` is also an array.  
It looks a little funny that you can make a an array or typle type with curly
brace `{ }` notation, but it works.
There is some documentation of this behavior in old TypeScript 
[release notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-1.html).

The result type is an array of objects with "str" and "num" fields, as expected:

```ts
  const w: [{ num: number }, { str: string }] = wrapEm(1, "foo");
```

