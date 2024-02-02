export function multiKeySet<A, B, V>(
  m: Map<A, Map<B, V>>,
  a: A,
  b: B,
  v: V
): void {
  const bMap = m.get(a) || new Map();
  m.set(a, bMap);
  bMap.set(b, v);
}

const tokenRegex = /\b(\w+)\b/gi;
export function replaceTokens3(
  text: string,
  replace: Record<string, string>
): string {
  return text.replaceAll(tokenRegex, (s) => (s in replace ? replace[s] : s));
}

/** return an array partitioned into possibly overlapping groups */
export function grouped<T>(a: T[], size: number, stride = size): T[][] {
  const groups = [];
  for (let i = 0; i < a.length; i += stride) {
    groups.push(a.slice(i, i + size));
  }
  return groups;
}
/** group an array into subarrays by a key function */
export function groupBy<T, K>(a: T[], key: (t: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>();
  for (const t of a) {
    const k = key(t);
    const group = groups.get(k) || [];
    group.push(t);
    groups.set(k, group);
  }
  return groups;
}

/** partition an array into two parts by a discriminator function */
export function partition<T>(a: T[], partFn: (t: T) => boolean): [T[], T[]] {
  const yesPart: T[] = [];
  const noPart: T[] = [];
  for (const t of a) {
    partFn(t) ? yesPart.push(t) : noPart.push(t);
  }
  return [yesPart, noPart];
}
