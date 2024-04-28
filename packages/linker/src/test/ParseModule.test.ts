import { expect, test } from "vitest";
import { parseModule } from "../ParseModule.js";
import { simpleTemplate } from "../templates/SimpleTemplate.js";

test("simple fn export", () => {
  const src = `
    // #export
    fn one() -> i32 {
      return 1;
    }
  `;
  const module = parseModule(src);
  expect(module.exports.length).toBe(1);
  expect(module).toMatchSnapshot();
});

test("simple fn import", () => {
  const src = `
    // #import foo
    fn bar() { foo(); }
  `;
  const module = parseModule(src);
  expect(module.imports.length).toBe(1);
  expect(module.imports[0].name).toBe("foo");
  expect(module).toMatchSnapshot();
});

test("match #extends", () => {
  const src = `
    // #extends Foo
    // #extends Bar
    struct Elem {
      sum: f32
    }
  `;
  const module = parseModule(src);
  const merges = module.structs[0].extendsElems!;
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
  const module = parseModule(exportPrefix + "\n" + src);
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
  const textModule = parseModule(src);
  expect(textModule.name).toBe("my.module.com");
});

test.skip("simple #template preserves src map", () => {
  // TODO verify src map
  const src = `
    // #template simple
    fn foo() { XX }
  `;
  const expected = `
    // 
    fn foo() { /**/ }
  `;
  const templates = new Map([["simple", simpleTemplate.apply]]);
  const textModule = parseModule(src, templates, "./foo", { XX: "/**/" });
  expect(textModule.preppedSrc).includes("fn foo() { /**/ }");
  expect(textModule.preppedSrc).equals(expected);
  // console.log("prepped", textModule.srcMap);
  expect(textModule.srcMap.entries).length(3);
});
