import { expect, test } from "vitest";
import { ModuleRegistry, RegisterGenerator } from "../ModuleRegistry.js";
import { replaceTemplate } from "../templates/Replacer.js";

const fooGenerator: RegisterGenerator = {
  name: "foo",
  moduleName: "test.generator",
  generate: (fnName: string, params: Record<string, string>): string => {
    return `fn ${fnName}() { /* ${params.name}Impl */ }`;
  },
  args: ["name"],
};

test("#import from code generator", () => {
  const src = `
    #module main
    #import foo(bar)

    fn main() { foo(); }
  `;
  const registry = new ModuleRegistry({
    rawWgsl: [src],
    generators: [fooGenerator],
  });
  const linked = registry.link("main");
  expect(linked).contains("barImpl");
});

test("#import as from code generator", () => {
  const src = `
    #import foo(bar) as zip

    fn main() { zip(); }
  `;
  const registry = new ModuleRegistry({
    wgsl: { "./main.wgsl": src },
    generators: [fooGenerator],
  });
  const linked = registry.link("main");
  expect(linked).contains("fn zip()");
});

test("#import with arg from code generator", () => {
  const src = `
    #import foo(bar)

    fn main() { foo(); }
  `;
  const registry = new ModuleRegistry({
    wgsl: { "./main": src },
    generators: [fooGenerator],
  });
  const linked = registry.link("main");
  expect(linked).contains("barImpl");
});

test("#import with ext.arg from code generator", () => {
  const src = `
    #import foo(ext.zee)

    fn main() { foo(); }
  `;
  const registry = new ModuleRegistry({
    wgsl: { "./main": src },
    generators: [fooGenerator],
  });
  const linked = registry.link("main", { zee: "zog" });
  expect(linked).contains("zogImpl");
});

test.skip("#import conficted code gen fn", () => {
  const src = `
    #module main
    #import bar
    fn foo() { bar(); }
  `;

  const module0 = `
    #import foo(boo)

    #export
    fn bar() { foo(); }
  `;

  const registry = new ModuleRegistry({
    rawWgsl: [src, module0],
    generators: [fooGenerator],
  });
  const linked = registry.link("main", { zee: "zog" });
  expect(linked).contains("booImpl");
  expect(linked).contains("fn foo0()");
  expect(linked).contains("foo0();");
});

test("external param applied to generator", () => {
  const src = `
    #import foo(workgroupThreads)

    fn main() {
      foo();
    }
  `;

  /** expects a parameter named threads */
  function generate(name: string, params: Record<string, string>): string {
    return `fn ${name}() { for (var step = 0; step < ${params.threads}; step++) { } }`;
  }

  const gen: RegisterGenerator = {
    name: "foo",
    args: ["threads"],
    generate,
    moduleName: "test.module",
  };

  const registry = new ModuleRegistry({
    wgsl: { "./main": src },
    templates: [replaceTemplate],
    generators: [gen],
  });
  const linked = registry.link("main", { workgroupThreads: 128 });
  expect(linked).includes("step < 128");
});

// test("#import code generator snippet with support", () => {
//   function generate(params: { name: string; logType: string }): TextInsert {
//     return {
//       src: `log(${params.name});`,
//       rootSrc: `fn log(logVar: ${params.logType}) {}`,
//     };
//   }

//   const src = `
//     fn foo() {
//       let bar: i32 = 1
//       #import log(bar, i32)
//     }
//   `;
//   const registry = new ModuleRegistry();
//   registry.registerGenerator("log", generate as CodeGenFn, ["name", "logType"]);
//   const linked = linkWgsl(src, registry);
//   expect(linked).contains("log(bar);");
//   expect(linked).contains("fn log(logVar: i32) {}");
// });
