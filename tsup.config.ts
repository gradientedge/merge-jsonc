import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: {
      index: "src/core.ts",
      cli: "src/cli.ts",
    },
    format: ["esm"],
    dts: false,
    splitting: false,
    sourcemap: false,
    clean: true,
    target: "node22",
    banner: { js: "#!/usr/bin/env node" },
    outDir: "dist",
    outExtension() {
      return { js: ".js" };
    },
  },
]);
