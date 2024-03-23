/// <reference types="vite/client" />
import { test, expect } from "vitest";
import { ModuleRegistry } from "../ModuleRegistry.js";

const wgsl1 = import.meta.glob("./wgsl_1/*.wgsl", { as: "raw", eager: true });
const wgsl2 = import.meta.glob("./wgsl_2/*.wgsl", { as: "raw", eager: true });

test("basic import glob", async () => {
  const linked = new ModuleRegistry({ wgsl: wgsl1 }).link("main");
  expect(linked).contains("fn bar()");
});

test("#import from path ./util", async () => {
  const linked = new ModuleRegistry({ wgsl: wgsl2 }).link("main2");
  expect(linked).contains("fn bar()");
});
