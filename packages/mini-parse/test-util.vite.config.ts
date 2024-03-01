/// <reference types="vitest" />
import { LibraryOptions, defineConfig } from "vite";
// import { visualizer } from "rollup-plugin-visualizer";
import { baseViteConfig } from "./base.vite.config.js";

const config = baseViteConfig();
config.build!.emptyOutDir = false;
(config.build!.lib as LibraryOptions).formats = ["es"];

// config.plugins?.push(visualizer({ brotliSize: true, gzipSize: true })); // generate stats.html size report

export default defineConfig(config);