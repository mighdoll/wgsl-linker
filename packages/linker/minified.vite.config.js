
/// <reference types="vitest" />
import { defineConfig } from "vite";
import { baseViteConfig } from "./vite-base-config.js";
// import { visualizer } from "rollup-plugin-visualizer";

const config = baseViteConfig();
config.build.minify = "terser";
config.build.emptyOutDir = false;
config.build.lib.fileName = "minified";

export default defineConfig(config);
