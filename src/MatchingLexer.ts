import { tracing, parserLog } from "./ParserTracing.js";
import { Token, TokenMatcher } from "./TokenMatcher.js";

export interface Lexer {
  next(): Token | undefined;
  withMatcher<T>(newMatcher: TokenMatcher, fn: () => T): T;
  withIgnore<T>(newIgnore: Set<string>, fn: () => T): T;
  position(pos?: number): number;
  eof(): boolean;
}

interface MatcherStackElem {
  matcher: TokenMatcher;
  ignore: Set<string>;
}

export function matchingLexer(
  src: string,
  rootMatcher: TokenMatcher,
  ignore = new Set(["ws"])
): Lexer {
  let matcher = rootMatcher;
  const matcherStack: MatcherStackElem[] = [];

  matcher.start(src);

  function next(): Token | undefined {
    if (eof()) return undefined;

    let token = matcher.next();
    while (token && ignore.has(token.kind)) {
      if (eof()) return undefined;
      token = matcher.next();
    }
    if (tracing) {
      const text = quotedText(token?.text);
      parserLog(`: ${text} (${token?.kind}) ${matcher.position()}`);
    }
    return token;
  }

  function pushMatcher(newMatcher: TokenMatcher, newIgnore: Set<string>): void {
    const position = matcher.position();
    matcherStack.push({ matcher, ignore });
    newMatcher.start(src, position);
    matcher = newMatcher;
    ignore = newIgnore;
  }

  function popMatcher(): void {
    const position = matcher.position();
    const elem = matcherStack.pop();
    if (!elem) {
      console.error("too many pops"), rootMatcher;
      return;
    }
    matcher = elem.matcher;
    ignore = elem.ignore;

    matcher.position(position);
  }

  function position(pos?: number): number {
    if (pos !== undefined) {
      matcher.start(src, pos);
    }
    return matcher.position();
  }

  function withMatcher<T>(newMatcher: TokenMatcher, fn: () => T): T {
    return withMatcherIgnore(newMatcher, ignore, fn);
  }

  function withIgnore<T>(newIgnore: Set<string>, fn: () => T): T {
    return withMatcherIgnore(matcher, newIgnore, fn);
  }

  function withMatcherIgnore<T>(
    tokenMatcher: TokenMatcher,
    ignore: Set<string>,
    fn: () => T
  ): T {
    pushMatcher(tokenMatcher, ignore);
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
    withIgnore,
    eof,
  };
}

export function quotedText(text?: string): string {
  return text ? `'${text.replace(/\n/g, "\\n")}'` : "";
}
