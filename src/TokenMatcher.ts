export interface Token {
  kind: string;
  text: string;
}

export interface TokenMatcher {
  start(src: string, position?: number): void;
  next(): Token | undefined;
  position(): number;
}

export function tokenMatcher(
  matchers: Record<string, string | RegExp>
): TokenMatcher {
  const groups: string[] = Object.keys(matchers);
  let src = "";

  const expParts = Object.values(matchers).map(toRegexSource).join("|");
  const exp = new RegExp(expParts, "idg");

  function start(text: string, position = 0): void {
    src = text;
    exp.lastIndex = position;
  }

  function next(): Token | undefined {
    if (!src) {
      throw new Error("start() first");
    }
    const matches = exp.exec(src);
    const matchedIndex = findGroupDex(matches?.indices);
    if (matchedIndex) {
      const { startEnd, groupDex } = matchedIndex;
      const kind = groups[groupDex];
      const text = src.slice(startEnd[0], startEnd[1]);
      console.log({ kind, text });
      return { kind, text };
    }
  }

  function position(): number {
    return exp.lastIndex;
  }

  return { start, next, position };
}

interface MatchedIndex {
  startEnd: [number, number];
  groupDex: number;
}

function findGroupDex(
  indices: RegExpIndicesArray | undefined
): MatchedIndex | undefined {
  if (indices) {
    for (let i = 1; i < indices.length; i++) {
      const startEnd = indices[i];
      if (startEnd) {
        return { startEnd, groupDex: i - 1 };
      }
    }
  }
}

function toRegexSource(e: RegExp | string): string {
  if (typeof e === "string") {
    return `(${escapeRegex(e)})`;
  } else {
    return `(${e.source})`;
  }
}

const regexSpecials = /[$+*.?|(){}[\]\\/^]/g;

export function escapeRegex(s: string): string {
  return s.replace(regexSpecials, "\\$&");
}
