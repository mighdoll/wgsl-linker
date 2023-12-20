import { Token, TokenMatcher } from "./TokenMatcher.js";

export interface Lexer {
  next(): Token | undefined;
  peek(): Token | undefined;
  pushMatcher(tokenMatcher: TokenMatcher): void;
  popMatcher(): void;
  withMatcher<T>(tokenMatcher: TokenMatcher, fn: () => T): T;
  tryParse<T>(fn: () => T): T | undefined;
  position(): number;
  setPosition(pos: number): void;
}

export function matchingLexer(src: string, rootMatcher: TokenMatcher): Lexer {
  let matcher = rootMatcher;
  const matcherStack: TokenMatcher[] = [];
  const peeked: (Token | undefined)[] = [];

  matcher.start(src);

  function next(): Token | undefined {
    if (peeked.length > 0) {
      return peeked.shift();
    } else {
      let token = matcher.next();
      while (token?.kind === "ws") {
        token = matcher.next();
      }
      return token;
    }
  }

  function tryParse<T>(fn: () => T): T {
    const startPos = matcher.position();
    const result = fn();
    if (!result) {
      matcher.start(src, startPos);
      // TODO drop peek?
    }
    return result;
  }

  function peek(): Token | undefined {
    if (peeked.length === 0) {
      peeked.push(next());
    }
    return peeked[0];
  }

  function pushMatcher(newMatcher: TokenMatcher): void {
    const position = matcher.position();
    matcherStack.push(matcher);
    newMatcher.start(src, position);
    matcher = newMatcher;
  }

  function popMatcher(): void {
    const position = matcher.position();
    matcher =
      matcherStack.pop() || (console.error("too many pops"), rootMatcher);
    matcher.start(src, position);
  }

  function position(): number {
    return matcher.position();
  }
  function setPosition(pos: number): void {
    matcher.start(src, pos);
  }

  function withMatcher<T>(tokenMatcher: TokenMatcher, fn: () => T): T {
    pushMatcher(tokenMatcher);
    const result = fn();
    popMatcher();
    return result;
  }

  return {
    next,
    peek,
    tryParse,
    position,
    setPosition,
    withMatcher,
    pushMatcher,
    popMatcher,
  };
}
