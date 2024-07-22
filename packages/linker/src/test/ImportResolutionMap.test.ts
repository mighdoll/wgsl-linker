import { expect, test } from "vitest";
import { importResolutionMap } from "../ImportResolutionMap.js";
import {
  exportsToStrings,
  pathsToStrings
} from "../LogResolveMap.js";
import { ModuleRegistry } from "../ModuleRegistry.js";
import { TextExport, TextModule } from "../ParseModule.js";

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
  const resolveMap = importResolutionMap(impMod, treeImports, parsedModules);

  expect(resolveMap.exportMap.size).eq(1);
  const [impPath, modExp] = [...resolveMap.exportMap.entries()][0];
  expect(impPath).eq("bar/foo");
  expect(modExp.module.name).eq("bar");
  expect((modExp.exp as TextExport).ref.name).eq("foo");

  const pathMapEntries = [...resolveMap.pathsMap.entries()];
  expect(pathMapEntries.length).eq(1);
  const [impSegments, expSegments] = pathMapEntries[0];
  expect(impSegments).deep.eq(["bar", "foo"]);
  expect(expSegments).deep.eq(["bar", "foo"]);
});

test("tree with path segment list", () => {
  const registry = new ModuleRegistry({
    wgsl: {
      "main.wgsl": `
         import bar::{foo, zah};
         fn main() { foo(); zah();}
      `,
      "./bar.wgsl": `
         export fn foo() { }
         export fn zah() { }
        `,
    },
  });
  const parsedModules = registry.parsed();
  const impMod = parsedModules.findTextModule("main")!;
  const treeImports = impMod.imports.filter((i) => i.kind === "treeImport");
  const resolveMap = importResolutionMap(impMod, treeImports, parsedModules);
  expect(pathsToStrings(resolveMap)).deep.eq([
    "bar/foo -> bar/foo",
    "bar/zah -> bar/zah",
  ]);
  expect(exportsToStrings(resolveMap)).deep.eq([
    "bar/foo -> bar/foo",
    "bar/zah -> bar/zah",
  ]);
});

test("tree with trailing wildcard", () => {
  const registry = new ModuleRegistry({
    wgsl: {
      "main.wgsl": `
         import bar::*;
         fn main() { foo(); zah();}
      `,
      "./bar.wgsl": `
         export fn foo() { }
         export fn zah() { }
        `,
    },
  });
  const parsedModules = registry.parsed();
  const impMod = parsedModules.findTextModule("main")!;
  const treeImports = impMod.imports.filter((i) => i.kind === "treeImport");
  const resolveMap = importResolutionMap(impMod, treeImports, parsedModules);
  expect(pathsToStrings(resolveMap)).deep.eq([
    "bar/foo -> bar/foo",
    "bar/zah -> bar/zah",
  ]);
  expect(exportsToStrings(resolveMap)).deep.eq([
    "bar/foo -> bar/foo",
    "bar/zah -> bar/zah",
  ]);

});

test.skip("tree with generator");
test.skip("tree with segment list of trees");
