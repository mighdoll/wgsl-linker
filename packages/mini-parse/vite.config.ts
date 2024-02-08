/// <reference types="vitest" />
import { defineConfig } from "vite";
import { resolve } from "path";
import tsconfigPaths from "vite-tsconfig-paths";
import dts from "vite-plugin-dts";
// import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig({
  plugins: [
    tsconfigPaths(),
    dts(), // generate 
    // visualizer({ brotliSize: true, gzipSize: true }), // generate stats.html size report
  ],
  build: {
    lib: {
      name: "mini-parse",
      entry: [
        resolve(__dirname, "src/index.ts"),
      ],
    },
    // minify: 'terser',
    sourcemap: true,
  },
  test: {
    setupFiles: "./src/test/TestSetup.ts",
  },
});
