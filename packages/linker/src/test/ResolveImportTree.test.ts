import { expect, test } from "vitest";
import { ModuleRegistry } from "../ModuleRegistry.js";
import { TextExport, TextModule } from "../ParseModule.js";
import { resolveImports } from "../ResolveImportTree.js";

test("simple tree", () => {
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
  const resolved = resolveImports(impMod, treeImports, parsedModules);
  expect(resolved.pathsMap).empty;
  expect(resolved.exportMap.size).eq(1);
  const [impPath, modExp] = [...resolved.exportMap.entries()][0];
  expect(impPath).to.deep.eq(["bar", "foo"]);
  expect(modExp.module.name).eq("bar");
  expect((modExp.exp as TextExport).ref.name).eq("foo");
});

test.skip("tree with path segment list");
test.skip("tree with trailing wildcard");
test.skip("tree with generator");
