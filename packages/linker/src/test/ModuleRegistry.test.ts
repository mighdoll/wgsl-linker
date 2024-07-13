import { expect, test } from "vitest";
import { ModuleRegistry, TextModuleExport } from "../ModuleRegistry.js";
import { dlog } from "berry-pretty";
import { TextModule } from "../ParseModule.js";

test("moduleByPath", () => {
  const registry = new ModuleRegistry({
    wgsl: {
      "main.wgsl": `
         module bar
         export fn foo() { }
      `,
    },
  });
  registry._parseSrc();
  const m = registry.moduleByPath(["bar"]);
  expect(m?.name).eq("bar");
});

test("getModuleExport", () => {
  const registry = new ModuleRegistry({
    wgsl: {
      "main.wgsl": `
         import bar::foo;
         module main
         fn main() { foo(); }
      `,
      "bar.wgsl": `
         module bar

         export fn foo() { }
        `,
    },
  });
  registry._parseSrc();
  const impMod = registry.moduleByPath(["main"]) as TextModule;

  const m = registry.getModuleExport2(impMod, [
    "bar",
    "foo",
  ]) as TextModuleExport;
  expect(m.module.name).eq("bar");
});
