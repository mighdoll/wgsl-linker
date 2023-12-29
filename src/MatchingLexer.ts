import { Token, TokenMatcher } from "./TokenMatcher.js";

export interface Lexer {
  next(): Token | undefined;
  withMatcher<T>(tokenMatcher: TokenMatcher, fn: () => T): T;
  position(pos?: number): number;
  eof(): boolean;
}

export function matchingLexer(
  src: string,
  rootMatcher: TokenMatcher,
  ignore = new Set(["ws"])
): Lexer {
  let matcher = rootMatcher;
  const matcherStack: TokenMatcher[] = [];

  matcher.start(src);

  function next(): Token | undefined {
    let token = matcher.next();
    while (token && ignore.has(token.kind)) {
      token = matcher.next();
    }
    // console.log({ token });
    return token;
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
    matcher.position(position);
  }

  function position(pos?: number): number {
    if (pos !== undefined) {
      matcher.start(src, pos);
    }
    return matcher.position();
  }

  function withMatcher<T>(tokenMatcher: TokenMatcher, fn: () => T): T {
    pushMatcher(tokenMatcher);
    const result = fn();
    popMatcher();
    return result;
  }

  function eof(): boolean {
    return matcher.position() === src.length;
  }

  return {
    next,
    position,
    withMatcher,
    eof,
  };
}
