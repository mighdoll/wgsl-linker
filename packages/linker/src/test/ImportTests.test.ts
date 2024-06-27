import { expect, test } from "vitest";
import { linkerTests as importTests } from "./shared/ImportTests.js";
import { ModuleRegistry } from "../ModuleRegistry.js";
import { trimSrc } from "./shared/StringUtil.js";

interface LinkExpectation {
  includes?: string[];
  excludes?: string[];
  linked?: string;
}

const expectations: Record<string, LinkExpectation> = {
  "#import foo": {
    linked: `
      fn main() {
        foo();
      }

      fn foo() { }
    `,
  },
};

importTests.forEach((t) => {
  test(t.name, () => {
    const expectation = expectations[t.name];
    if (!expectation) {
      throw new Error(`No expectation found for test "${t.name}"`);
    }
    const { includes, excludes, linked } = expectation;
    const srcs = Object.entries(t.src).map(([name, wgsl]) => {
      const trimmedSrc = trimSrc(wgsl);
      return [name, trimmedSrc] as [string, string];
    });
    const main = srcs[0][0];
    const wgsl = Object.fromEntries(srcs);
    const registry = new ModuleRegistry({ wgsl });
    const result = registry.link(main);
    if (linked !== undefined) {
      const expectTrimmed = trimSrc(linked);
      expect(result).eq(expectTrimmed);
    }
    if (includes !== undefined) {
      includes.forEach((inc) => {
        expect(result).includes(inc);
      });
    }
    if (excludes !== undefined) {
      excludes.forEach((exc) => {
        expect(result).not.includes(exc);
      });
    }
  });
});
