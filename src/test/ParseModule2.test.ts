import { expect, test } from "vitest";
import { parseModule2 } from "../ParseModule2.js";
import { dlog } from "berry-pretty";

test("simple fn export", () => {
  const src = `
    // #export
    fn one() -> i32 {
      return 1;
    }
  `;
  const module = parseModule2(src, "my.module");
  expect(module.exports.length).toBe(1);
  expect(module).toMatchSnapshot();
});

test("simple fn import", () => {
  const src = `
    // #import foo
    fn bar() { foo(); }
  `;
  const module = parseModule2(src, "my.module");
  expect(module.imports.length).toBe(1);
  expect(module.imports[0].name).toBe("foo");
  expect(module).toMatchSnapshot();
});

test("match #importMerge", () => {
  const src = `
    // #importMerge Foo
    // #importMerge Bar
    struct Elem {
      sum: f32
    }
  `;
  const module = parseModule2(src, "my.module");
  const merges = module.structs[0].importMerges!;
  expect(merges[0].name).eq("Foo");
  expect(merges[1].name).eq("Bar");
});

test("read simple struct export", () => {
  const exportPrefix = `// #export`;
  const src = `
    struct Elem {
      sum: f32
    }
  `;
  const module = parseModule2(exportPrefix + "\n" + src);
  expect(module.exports.length).toBe(1);
  const firstExport = module.exports[0];
  expect(firstExport.ref.name).toBe("Elem");
});

test("read #module", () => {
  const src = `
    // #module my.module.com
    // #export
    fn foo() {}
  `;
  const textModule = parseModule2(src);
  expect(textModule.name).toBe("my.module.com");
});
