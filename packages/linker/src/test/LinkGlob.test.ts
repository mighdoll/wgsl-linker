/// <reference types="vite/client" />
import { test, expect } from "vitest";
import { ModuleRegistry } from "../ModuleRegistry.js";

const wgsl = import.meta.glob("./wgsl_1/*.wgsl", { as: "raw", eager: true });

test("basic import glob", async () => {
  const registry = new ModuleRegistry();
  registry.registerMany(wgsl);
  const linked = registry.link("main");
  expect(linked).contains("fn bar()");
});
