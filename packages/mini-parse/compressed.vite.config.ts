/// <reference types="vitest" />
import { LibraryOptions, defineConfig } from "vite";
// import { visualizer } from "rollup-plugin-visualizer";
import { baseViteConfig } from "./vite-base-config.js";

// Note that this will include the debug tracing code, so
// so the size estimate is an overestimate of production size

const config = baseViteConfig();
config.build!.emptyOutDir = false;
config.build!.minify = "terser";
(config.build!.lib as LibraryOptions).formats = ["es", "cjs"];
(config.build!.lib as LibraryOptions).fileName = "minified";

// config.plugins?.push(visualizer({ brotliSize: true, gzipSize: true })); // generate stats.html size report

export default defineConfig(config);
