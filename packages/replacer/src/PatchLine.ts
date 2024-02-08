import { ctxLog } from "../../../src/LinkerLogging.js";
import { ParserContext } from "../../mini-parse/src/Parser.js";

/** for incrementally patching a line with #replace */
interface Patched {
  patchedPrefix: string;
  suffix: string;
}

/** apply all the replacements to the line */
export function patchLine(
  ctx: ParserContext,
  line: string,
  replaces: [string, string][]
): string[] {
  const dict: Record<string, any> = ctx.app.context;

  // scan through the patches, applying each patch and accumulating the patchedPrefx
  const patched = scan(replaces, patchOne, { patchedPrefix: "", suffix: line });

  // result is the patched prefixes plus any remaining suffix
  const prefixes = patched.map((p) => p.patchedPrefix);
  const last = patched.slice(-1)[0] || "";
  const result = [...prefixes, last.suffix].join("");
  return [result];

  /** apply one find,replaceKey patch to a string */
  function patchOne(kv: [string, string], current: Patched): Patched {
    const [key, replaceKey] = kv;
    const text = current.suffix;
    const found = text.indexOf(key);

    if (found >= 0) {
      const start = text.slice(0, found);
      const suffix = text.slice(found + key.length);
      const replaceValue = dict[replaceKey] || missingValue(replaceKey);
      return { patchedPrefix: start + replaceValue, suffix };
    } else {
      ctxLog(ctx, `replace target "${key}" not found`);
      return current;
    }
  }

  function missingValue(replaceKey: string): string {
    ctxLog(ctx, `replace value not found for ${replaceKey}`);
    return `?${replaceKey}?`;
  }
}

/** run an carrying function over every element in an array */
export function scan<T, U>(array: T[], fn: (a: T, b: U) => U, zero: U): U[] {
  const result = [zero];

  let current = zero;
  for (let i = 0; i < array.length; i++) {
    current = fn(array[i], current);
    result.push(current);
  }
  return result;
}
