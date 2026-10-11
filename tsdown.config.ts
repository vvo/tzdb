import { readFileSync } from "node:fs";

import { defineConfig, type UserConfig } from "tsdown";

import { compactTimeZones } from "./src/compact.ts";

const config: UserConfig = defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  platform: "neutral",
  // Old bundlers like webpack 4 parse the ESM build without transpiling it
  target: "es2018",
  dts: true,
  clean: true,
  plugins: [
    {
      // Bundles a third smaller copy of raw-time-zones.json, see src/compact.ts
      name: "compact-raw-time-zones",
      load(id) {
        if (!id.endsWith("/raw-time-zones.json")) {
          return null;
        }
        const compact = compactTimeZones(JSON.parse(readFileSync(id, "utf8")));
        return {
          code: [
            `import { expandTimeZones } from "./src/compact.ts";`,
            `export default /* @__PURE__ */ expandTimeZones(${JSON.stringify(compact)});`,
          ].join("\n"),
          moduleType: "ts",
        };
      },
    },
  ],
});

export default config;
