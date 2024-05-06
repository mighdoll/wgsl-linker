class Combo<V, N extends Record<string, any>> {
  constructor(value: V) {}

  named<K extends string>(name: K): Combo<V, N & { [key in K]: V }> {
    return this as any;
  }

  get result(): N {
    return {} as N;
  }
}

function seq<
  A1,
  A2 extends Record<string, any>,
  B1,
  B2 extends Record<string, any>,
>(a: Combo<A1, A2>, b: Combo<B1, B2>): Combo<[A1, B1], A2 & B2> {
  a && b;
  return null as any;
}

export function test(): void {
  const a = new Combo(1).named("A");
  const b = new Combo("foo").named("B");

  const v = a.result.A;

  const s = seq(a, b);

  const v2 = s.result.A + s.result.B;
}
