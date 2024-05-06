class Combo<V, N> {
  constructor(value: V) {}

  named<K extends string>(name: K): Combo<V, N & { [key in K]: V }> {
    return this as any;
  }

  get namedResult(): N {
    return {} as N;
  }

  get value(): V {
    return null as any;
  }
}

// get the V out of a Combo<V, any>
type ExtractValue<T> = T extends Combo<infer V, any> ? V : never;

// get the N out of a Combo<any, N>
type ExtractObject<T> = T extends Combo<any, infer N> ? N : never;

// this is a trick for converting A | B | C to A & B & C
// it works by putting U into a contravariant position by making it a function parameter (k: U) => void
// . typescript will intersect they types in contravariant positions
// . so then inferring the type of k gets us the intersection
// (and wrapping things in conditional types with ? : never gives us a stage to place the inferencing)
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I
) => void
  ? I
  : never;

// First Type param V to Combo:
//    { [key in keyof Ts]: ExtractValue<Ts[key]> },
//  This looks like an object type given the {} syntax. But it's not. As of TS 3.1,
//  type mapping over keys of an array or tuple returns an array or tuple type, not an object type.
//  Here's how it works:
//
//  [key in keyof Ts] is the indices of of Ts:
//     0, 1, ...
//  Ts[key] gets us the type of index corresponding Combo arg
//     Ts[0] is Combo<number, {A:number}>
//  ExtractValue gets just the first type parameter out of Combo
//     ExtractValue<Ts[0]> is number
//  So the resulting type mapping looks like this:
//    {0:number, 1:string, ...}
//  And because Ts is an array or tuple, Typescript interprets that as what we want:
//    [number, string]
//
// Second type param N to Combo
//    UnionToIntersection<ExtractObject<Ts[number]>>
//
//  Ts[number] is the type of the provided Combo arguments:
//      Combo<number, {A:number}>, Combo<string, B:string>, ...
//  Because this is covariant, ts combines the args into into a union:
//      Combo<number, {A:number}> | Combo<string, B:string> | ...
//  ExtractObject gets us the union of just the second combo type parameter
//      {A:number} | {B:string} | ...
//  UnionToIntersection converts the union to interexection
//      {A:number} & {B:string} & ...
//  which is equivalent to what we want:
//      {A:number, B:string, ...}

function seq<Ts extends Combo<any, Record<string, any>>[]>(
  // ...a: Ts  // both variants work
  ...a: [...Ts]
): Combo<
  { [key in keyof Ts]: ExtractValue<Ts[key]> },
  UnionToIntersection<ExtractObject<Ts[number]>>
> {
  return a as any;
}

export function test(): void {
  const a = new Combo(1).named("A");
  const b = new Combo("foo").named("B");

  // const zz = ff(a,b);
  const av: number = a.value;
  const bv: string = b.value;

  const ar: number = a.namedResult.A;
  const br: string = b.namedResult.B;

  const s = seq(a, b);

  const sv: [number, string] = s.value;
  const sn: { A: number; B: string } = s.namedResult;
}

// function ff<Ts extends Array<Combo<any, Record<string, any>>>>(
//   ...a: Ts
// ): { [key in keyof Ts]:[key]} {
//   return null as any;
// }
