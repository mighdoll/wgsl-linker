/// <reference types="vite/client" />
import { test, expect } from "vitest";
import { ModuleRegistry } from "../ModuleRegistry.js";

const wgsl1 = import.meta.glob("./wgsl_1/*.wgsl", { as: "raw", eager: true });
const wgsl2 = import.meta.glob("./wgsl_2/*.wgsl", { as: "raw", eager: true });

test("basic import glob", async () => {
  const registry = new ModuleRegistry();
  registry.registerMany(wgsl1);
  const linked = registry.link("main");
  expect(linked).contains("fn bar()");
});

test("#import from path ./util", async () => {
  const registry = new ModuleRegistry();
  registry.registerMany(wgsl2);
  const linked = registry.link("main2");
  expect(linked).contains("fn bar()");
});
