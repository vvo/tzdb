import { execFileSync } from "node:child_process";
import { copyFileSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";

import { build, type Plugin } from "esbuild";

import { compactTimeZones } from "../src/compact.ts";

const compactRawTimeZones: Plugin = {
  name: "compact-raw-time-zones",
  setup(build) {
    build.onLoad({ filter: /raw-time-zones\.json$/ }, ({ path: file }) => {
      const compact = compactTimeZones(JSON.parse(readFileSync(file, "utf8")));
      const expand = path.join(import.meta.dirname, "../src/compact.ts");
      return {
        loader: "ts",
        resolveDir: path.dirname(file),
        contents: [
          `import { expandTimeZones } from ${JSON.stringify(expand)};`,
          `export default /* @__PURE__ */ expandTimeZones(${JSON.stringify(compact)});`,
        ].join("\n"),
      };
    });
  },
};

rmSync("dist", { recursive: true, force: true });

for (const [format, outfile] of [
  ["esm", "dist/index.js"],
  ["cjs", "dist/index.cjs"],
] as const) {
  await build({
    entryPoints: ["src/index.ts"],
    bundle: true,
    format,
    outfile,
    platform: "neutral",
    // Old bundlers like webpack 4 parse the ESM build without transpiling it
    target: "es2018",
    plugins: [compactRawTimeZones],
  });
}

execFileSync("tsc", ["--project", "tsconfig.build.json"]);
copyFileSync("dist/types/index.d.ts", "dist/index.d.ts");
copyFileSync("dist/types/index.d.ts", "dist/index.d.cts");
rmSync("dist/types", { recursive: true });
