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

#### Extending a Record Type

```
  class KeyValues<N extends Record<string, any>> {
    add<K extends string, V>(name: K, value:V): Tags<N & { [key in K]: V[] }> 
  }
```

## Intersecting to Build Type Safe Records
Let's say we have two Record types `{a: string}` and `{b: number}`. 
The type constructor below, `Intersection`, will combine 
the two Record types like this: `{a: string} & {b: number}`, which
is the same as `{a: string; b: number}`. 
That's why `Intersection` is so handy for type safely constructing Record types 
from other Records.

It's typical in type manipulation to find that you have a union type.
Sometimes we'd want the union. A union of the records above would give us 
the choice of either type: `{a: string} | {b: number}`.
But for combining into a single Record, we want the intersection type.

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

## Conditional Types to Decompose Union Types

```
export type ResultFromArg<A extends CombinatorArg> =
  A extends Parser<infer R, any>
    ? R
    : A extends string
      ? string
      : A extends () => Parser<infer R, any>
        ? R
        : never;
```

## Recover Specific Record Key Names
Sometimes you have a Record, 

```
export type KeyedRecord<T> = { [A in keyof T]: T[A] };
```

## Mapped tuple types
This is clearly documented, but only 

```
export type SeqValues<P extends CombinatorArg[]> = {
  [key in keyof P]: ResultFromArg<P[key]>;
};
```