import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/search.ts"],
    format: ["esm"],
    target: "node20",
    platform: "node",
    bundle: true,
    clean: true,
    banner: {
      js: "#!/usr/bin/env node",
    },
  },
  {
    entry: ["src/index.ts"],
    format: ["esm"],
    target: "node20",
    platform: "neutral",
    bundle: true,
    dts: true,
    clean: false,
    external: ["fast-xml-parser"],
  },
]);
