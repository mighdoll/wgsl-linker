/// <reference types="vitest" />
import { defineConfig } from "vite";
import { resolve } from "path";
import tsconfigPaths from "vite-tsconfig-paths";
import dts from "vite-plugin-dts";
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig({
  plugins: [tsconfigPaths(), dts(), visualizer({ brotliSize: true })],
  build: {
    lib: {
      entry: [
        resolve(__dirname, "src/index.ts"),
        resolve(__dirname, "src/ReplaceTemplate.ts"),
      ],
    },
    sourcemap: true,
  },
  test: {
    setupFiles: "./src/test/TestSetup.ts",
  },
});
