import { Token, TokenMatcher } from "./TokenMatcher.js";

export interface Lexer {
  next(): Token | undefined;
  withMatcher<T>(tokenMatcher: TokenMatcher, fn: () => T): T;
  tryParse<T>(fn: () => T): T | undefined;
  position(pos?: number): number;
}

export function matchingLexer(src: string, rootMatcher: TokenMatcher): Lexer {
  let matcher = rootMatcher;
  const matcherStack: TokenMatcher[] = [];

  matcher.start(src);

  function next(): Token | undefined {
    let token = matcher.next();
    while (token?.kind === "ws") {
      token = matcher.next();
    }
    // console.log({ token });
    return token;
  }

  function tryParse<T>(fn: () => T): T {
    const startPos = matcher.position();
    const result = fn();
    if (!result) {
      matcher.start(src, startPos);
    }
    return result;
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

  function position(pos?: number): number {
    if (pos !== undefined) {
      matcher.start(src, pos);
      return pos;
    }
    return matcher.position();
  }

  function withMatcher<T>(tokenMatcher: TokenMatcher, fn: () => T): T {
    pushMatcher(tokenMatcher);
    const result = fn();
    popMatcher();
    return result;
  }

  return {
    next,
    tryParse,
    position,
    withMatcher,
  };
}
