export interface Token {
  kind: string;
  text: string;
}

interface TokenMatcher {
  next(): Token | undefined;
  start(src: string): void;
}

export function tokenMatcher(
  matchers: Record<string, string | RegExp>
): TokenMatcher {
  const groups: string[] = Object.keys(matchers);
  let src = "";

  const expParts = Object.values(matchers).map(toRegexSource).join("|");
  const exp = new RegExp(expParts, "idg");

  function start(text: string): void {
    src = text;
    exp.lastIndex = 0;
  }

  function next(): Token | undefined {
    const matches = exp.exec(src);
    const matchedIndex = findGroupDex(matches?.indices);
    if (matchedIndex) {
      const { startEnd, groupDex } = matchedIndex;
      const kind = groups[groupDex];
      const text = src.slice(startEnd[0], startEnd[1]);
      return { kind, text };
    }
  }

  return { next, start };
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
