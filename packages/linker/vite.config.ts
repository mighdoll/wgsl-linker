/// <reference types="vitest" />
import { defineConfig } from "vite";
import { baseViteConfig } from "./vite-base-config.js";
// import { visualizer } from "rollup-plugin-visualizer";

const config = baseViteConfig();
config.test = { setupFiles: "./src/test/TestSetup.ts" };
config.build.emptyOutDir = false;

export default defineConfig(config);
