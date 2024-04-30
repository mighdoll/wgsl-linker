import { expect, test } from "vitest";
import { parseModule } from "../ParseModule.js";
import { simpleTemplate } from "../templates/SimpleTemplate.js";
import { logCatch } from "mini-parse/test-util";
import { _withBaseLogger } from "mini-parse";

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

test("simple #template preserves src map", () => {
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
  expect(textModule.srcMap.entries).length(3);
});

test("parse error shows correct line after simple #template", () => {
  const src = `
    // #template simple
    fn foo () { XX }
    fn () { } // oops
  `;
  const templates = new Map([["simple", simpleTemplate.apply]]);
  const { log, logged } = logCatch();
  _withBaseLogger(log, () => {
    parseModule(src, templates, "./foo", { XX: "/**/" });
  });
  expect(logged()).toMatchInlineSnapshot(`
    "missing fn name
        fn () { } // oops   Ln 4
          ^"
  `);
});

test("parse error shows correct line after #ifdef ", () => {
  const src = `
    // #if FALSE
    foo
    bar
    // #endif
    fn () { } // oops
  `;
  const templates = new Map([["simple", simpleTemplate.apply]]);
  const { log, logged } = logCatch();
  _withBaseLogger(log, () => {
    parseModule(src, templates, "./foo", { XX: "/**/" });
  });
  expect(logged()).toMatchInlineSnapshot(`
    "missing fn name
        fn () { } // oops   Ln 6
          ^"
  `);
});

test("parse error shows correct line after #ifdef and simple #template", () => {
  const src = `
    // #if FALSE
    foo
    bar
    // #endif
    // #template simple
    fn foo () { XX }
    fn () { } // oops
  `;
  const templates = new Map([["simple", simpleTemplate.apply]]);
  const { log, logged } = logCatch();
  _withBaseLogger(log, () => {
    parseModule(src, templates, "./foo", { XX: "/**/" });
  });
  expect(logged()).toMatchInlineSnapshot(`
    "missing fn name
        fn () { } // oops   Ln 8
          ^"
  `);
});
