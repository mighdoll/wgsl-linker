import { expect, test } from "vitest";
import { resolveImport } from "../ResolveImport.js";
import { ModuleRegistry } from "../ModuleRegistry.js";
import { importResolutionMap } from "../ImportResolutionMap.js";
import { TextExport, TextModule } from "../ParseModule.js";

test("resolveImport foo() from import bar::foo", () => {
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
  const parsedModules = registry.parsed();
  const impMod = parsedModules.moduleByPath(["main"]) as TextModule;
  const treeImports = impMod.imports.filter((i) => i.kind === "treeImport");
  const resolveMap = importResolutionMap(impMod, treeImports, parsedModules);

  const found = resolveImport("foo", resolveMap);
  expect(found).toBeDefined();
  expect(found?.module.name).eq("bar");
  expect((found?.exp as TextExport).ref.name).eq("foo");
});

test("resolveImport bar::foo() from import bar::foo", () => {
  const registry = new ModuleRegistry({
    wgsl: {
      "main.wgsl": `
         import bar::foo;
         module main
         fn main() { bar::foo(); }
      `,
      "bar.wgsl": `
         module bar

         export fn foo() { }
        `,
    },
  });
  const parsedModules = registry.parsed();
  const impMod = parsedModules.moduleByPath(["main"]) as TextModule;
  const treeImports = impMod.imports.filter((i) => i.kind === "treeImport");
  const resolveMap = importResolutionMap(impMod, treeImports, parsedModules);
  const found = resolveImport("bar::foo", resolveMap);
  expect(found).toBeDefined();
  expect(found?.module.name).eq("bar");
  expect((found?.exp as TextExport).ref.name).eq("foo");
});