import { dlog } from "berry-pretty";
import { expect, test } from "vitest";
import { ModuleRegistry } from "../ModuleRegistry.js";
import { TextExport, TextModule } from "../ParseModule.js";
import {
  ResolvedExportElement,
  resolvedToString,
  resolveImports,
} from "../ResolveImportTree.js";
import { parsed } from "yargs";

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
  const parsedModules = registry.parsed()
  const impMod = parsedModules.moduleByPath(["main"]) as TextModule;

  const treeImports = impMod.imports.filter((i) => i.kind === "treeImport");
  const resolved = resolveImports(impMod, treeImports, parsedModules);
  expect(resolved.size).eq(1);
  const [imp, exp] = resolved.entries().next().value as [
    string[],
    ResolvedExportElement,
  ];
  expect(imp).to.deep.eq(["bar", "foo"]);
  expect(exp.expMod.module.name).eq("bar");
  expect((exp.expMod.exp as TextExport).ref.name).eq("foo");
});

test.skip("tree with path segment list");
test.skip("tree with trailing wildcard");
test.skip("tree with generator");
