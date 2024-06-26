import { expect, test } from "vitest";
import { importTests } from "../../../shared-tests/src/test-cases/ImportTests.js";
import { ModuleRegistry } from "../ModuleRegistry.js";
import { trimSrc } from "./shared/StringUtil.js";

interface LinkExpectation {
  includes?: string[];
  excludes?: string[];
  linked?: string;
}

// wgsl example src, indexed by name
const examplesByName = new Map(importTests.map((t) => [t.name, t.src]));

test('import { foo } from "./bar";', (ctx) => {
  linkTest(ctx.task.name, {
    linked: `
      fn main() {
        foo();
      }

      fn foo() { }
    `,
  });
});

test(`import { foo, boo } from "./bar";`, (ctx) => {
  linkTest(ctx.task.name, {
    linked: `
      fn main() {
        foo();
        boo();
      }

      fn foo() { }

      fn boo() { }
    `,
  });
});

test(`import foo, boo from ./bar`, (ctx) => {
  linkTest(ctx.task.name, {
    linked: `
      fn main() {
        foo();
        boo();
      }

      fn foo() { }

      fn boo() { }
    `,
  });
});

function linkTest(name: string, expectation: LinkExpectation): void {
  const exampleSrc = examplesByName.get(name);
  if (!exampleSrc) {
    throw new Error(`Skipping test "${name}"\nNo example found.`);
  }
  const srcs = Object.entries(exampleSrc).map(([name, wgsl]) => {
    const trimmedSrc = trimSrc(wgsl);
    return [name, trimmedSrc] as [string, string];
  });
  const main = srcs[0][0];
  const wgsl = Object.fromEntries(srcs);
  const registry = new ModuleRegistry({ wgsl });
  const result = registry.link(main);

  const { linked, includes, excludes } = expectation;

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
}
