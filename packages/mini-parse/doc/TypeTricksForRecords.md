Combining Records in TypeScript? 

I needed to learn some TypeScript type tricks 
for a [library](https://npmjs.com/package/mini-parse) that lets users
combine add to Records, merge Records, manage arrays of Records, etc.
[@Modderme123](TODO) gave me some TypeScript tips last week. 
I thought I'd write them up and share them with you too.

Here's five tricks, roughly in order of increasing trickiness:

1. [Extending a Record Type Using a Mapped Type](#extending-a-record-type-using-a-mapped-type)
1. [Mapped Tuple Types](#mapped-tuple-types)
1. [Infer a Type Without Passing a Type Parameter](#infer-a-type-without-passing-a-type-parameter)
1. [Intersecting to Build Type Safe Records](#intersecting-to-build-type-safe-records)
1. [Recovering Record Types from Record Intersections](#recovering-record-types-from-record-intersections)

## Extending a Record Type Using a Mapped Type

Let's say you're collecting fields into a Record type
and you want to add a field.

Here's an example of adding a field to Record in a type safe way:

```ts
// holds a set of tags, allows accumulating more tags
class Tags<N extends Record<string, any>> {
  // return a new Tags with the new tag added
  add<K extends string, V>(name: K, value: V): Tags<N & { [key in K]: V }> {}
  read(): N {}
}
```

You can use `Tags` like as follows, and the result will be properly typed.

```ts
const tags = new Tags().add("c", true);
const moreTags = tags.add("bar", "zap"); // add more fields
const record: { c: boolean; bar: string } = moreTags.read(); // properly typed result
```

There are two Typescript tricks involved in the typing of `add`.

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

## Mapped Tuple Types

There's a little trick for mapping over Tuple and Array types
that isn't mentioned in the main documentation for TypeScript
[Mapped Types](https://www.typescriptlang.org/docs/handbook/2/mapped-types.html).

#### Example
Let's try to convert an array of strings and numbers
to an array of objects with "str" and "num" fields.

We can convert the type of one element using a [conditional type](TODO).
If `T` is a string, the type constructor will return `{str: T}`,
and if `T` is a number, the type constructor will return `{num: T}`:

```ts
type Wrapped<T extends string | number> = T extends string
  ? { str: T }
  : T extends number
    ? { num: T }
    : T;
```

Here's how we might define a function that does the wrapping:

```ts
function wrapEm<T extends (string | number)[]>(...args: T): WrapElems<T> {}
```

Now, to define `WrapElems`..

#### Solution with Mappped Types

Here's a `WrapElems` type constructor.
It maps one type of array or tuple to another type of arrayor tuple,
applying the `Wrapped` type conversion on each element.

```ts
type WrapElems<T extends (string | number)[]> = {
  [key in keyof T]: Wrapped<T[key]>;
};
```

- `T` is an array, and so the
  [Mapped Type](https://www.typescriptlang.org/docs/handbook/2/mapped-types.html)
  type `{ [key in keyof T]: Wrapped<T[key]> }` is also an array.
  It looks a little funny that you can make an array or tuple type with curly
  brace `{ }` notation, but it works.
  There is some documentation of this behavior in old TypeScript
  [release notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-1.html).

The result type is an array of objects with "str" and "num" fields, as expected:

```ts
const w: [{ num: number }, { str: string }] = wrapEm(1, "foo");
```

## Infer a Type Without Passing a Type Parameter

#### Explicit type parameters are straightforward

Let's say you have a type that takes several type parameters.

```ts
interface ThreeParams<A, B, C> {
  a: A;
  b: B;
  c: C;
}
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

One way around these problems is to put a simpler, less parameterized type
on the api. Then we'll use 'infer' to magically pull out the types
we need but didn't specify as parameters. Here's an example:

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
function fooB<T extends Hidden>(a: Hidden): InferParamB<Hidden> {}
```

We've reduced the visible type parameters in the API here from three to one.
If there were more function parameters, multiple function overloads,
or more just type parameters, the simplification factor would be even greater.

The infer type constructor can be handy in more complicated situations too.
Here's an example with variable numbers of arguments.
This example also uses the TypeScript
[typeof](https://www.typescriptlang.org/docs/handbook/2/typeof-types.html) operator,
which works to give you the type of a term as long as you're in a type context,
e.g. between angle brackets < >.
We can even index to pick out the type of the first argument of the args array.

```ts
  // return type is the second type parameter of the first argument
  function fooH<T extends Hidden>(...args: T[]): InferB<typeof args[0]> {
```

By using 'infer' we can keep things simple on the side of the api that our caller uses,
and cleanly solve some complicated type problems on the inside.

##### Note: Still Need One Type Parameter
Could we have zero type parameters rather than one? 
It would be nice to be simpler, but that doesn't work so well.
Here, TypesScript leaves the internal types as `any`:

```ts
// return type any, not so helpful
function fooB_nope(a: Hidden): InferParamB<typeof a> {}
```

So we'll typically still need one type parameter:

```ts
// return type is second type parameter of ThreeParams
function fooB<T extends Hidden>(a: T): InferParamB<Hidden> {}
```

## Intersecting to Build Type Safe Records

Let's say we have two Record types `{a: string}` and `{b: number}`.
The type constructor below, `Intersection`, will combine
the two Record types like this: `{a: string} & {b: number}`, which
is almost the same as `{a: string; b: number}`. 
(See [Recovering Record Types](#recovering-record-types-from-record-intersections) below.)

It's typical in type manipulation to find that we have a union type.
A union of the records above would give us
the choice of either type: `{a: string} | {b: number}`.
Sometimes we'd want the union.
But for combining into a single Record, we'd want the intersection.
If we have the two Record type parameters in hand, 
easiest is to use the `&` operator to combine them.

But if we have an unspecified number of types, or a union type, 
the following `Intersection` type constructor
becomes helpful for type safely constructing Records. 

If you have a union type like `A | B | C`,
the `Intersection` type constructor will turn the union into an intersection like `A & B & C`.


```ts
type Intersection<U> = 
    (U extends any ? 
      (k: U) => void : never) extends 
      (k: infer I) => void ? 
    I : never;
```

The trick is described here in the
[TypeScript docs](https://www.typescriptlang.org/docs/handbook/advanced-types.html#type-inference-in-conditional-types)
and here on [Stack Overflow](https://stackoverflow.com/questions/50374908/transform-union-type-to-intersection-type).
The key move is to place the source type `U` into contravariant position
as a function parameter. Then when TypeScript infers the type
of the function parameter, it will be the intersection of the types in the union.

#### Why Function Argument Types Intersect - Contravariance

Types in a programming language are intended to define what 
programmers can use (type) safely.
What would be a type safe function to use where we expect
function with a single listed type? e.g. if we expect `(a:Insect) => number`, 
what functions are ok to use?

Generally it'll be safe to use a function with an argument 
can be a more general version of the argument.
If we have a function that takes an Insect and returns the number of legs,
we could type safely substitute a function that takes an Animal
and returns the number of legs. 
The more general function will count legs on insects along with all 
the other animals it handles.
So it'll be OK if our listed type (Insect)
`extends` our candidate type (Animal). 

Function arguments are little unusual in the direction of the `extends` relationship. 
Usually we'll expect that candidate types `extend` the listed type, 
but function arguments are different, 
so they're called _contra_-variant.

How does this contravariance apply to Records? 
If we have a function that takes an argument of type: `{a:string} | {b:number}`,
we can type safely use an alternate function
that takes an argument of type: `{a:string, b:number}`.

If we have a function that takes an argument of type `A | B | C`,
we could type safely replace it with a function
that takes an argument of `A & B & C`.

#### Intersection Uses a Contravariant Function Argument
So that's how `Intersection` works on a provided type `U`.
It invents a hypothetical function that uses `U` as a 
function argument. Let's call the first function `f`.

Then `Intersection` asks TypeScript to imagine 
a second function that `extends` the the first hypothetical function
with a function argument of type `I`.
Let's call the second function `g`. 

So `f extends g` - we wrote it that way. 
And due to contravariance of function argumnets, 
`I extends U`.
We ask TypeScript to `infer` the type of `I`.

If U is a union type, voila, TypeScript produces
the intersection type. And if U is a union of Records,
we end up with the intersection of Records, which is 
usually close enough to be considered a single merged Record.

## Recovering Record Types from Record Intersections

TypeScript sometimes has trouble inferring the type of a `Record` type parameter
after `Intersection`.

```ts
  type ARecord = Record<any, any>;
  type Verify<T extends ARecord> = T;  // will fail to typecheck if T is not a Record
```

`Intersection` typechecks sometimes:
```ts
  type SimpleIntersection<A extends ARecord, B extends ARecord> = Verify<A & B>;
  type ConcreteIntersect = Verify<Intersection<{ a: 1} | { b: 2}>>;
```

But not always:
```ts
  type ParamIntersect<A extends ARecord> = Verify<Intersection<A>>; // fails to typecheck
```

#### Solution - Recover the Record Type
The following will help recover the Record type after `Intersection`.

For basic Record types, try this:
```ts
type AsRecord<T> = { [A in keyof T]: T[A] };
```

For Records with array values, try this:
```ts
type AsRecordArray<T> =
  T extends Record<any, any[]> ? { [A in keyof T]: T[A] } : never;
```

Works!
```ts
  type ParamIntersect2<A extends ARecord> = Verify<AsRecord<Intersection<A>>>;

  // success:
  type Test1 = ParamIntersect2<{ a: 1} | { b: 2}>; // type Test1 = { a: 1; b: 2; }
```
