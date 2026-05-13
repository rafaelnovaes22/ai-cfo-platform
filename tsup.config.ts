import { defineConfig } from "tsup";

// Empacota apenas arquivos TypeScript do backend (sem .md, .json, etc).
// Entrypoint principal: server.ts. Workers e demais módulos são alcançados via imports.
export default defineConfig({
  entry: ["src/server.ts"],
  format: ["esm"],
  target: "node20",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  splitting: false,
  shims: false,
  dts: false,
  skipNodeModulesBundle: true,
  // tsup respeita tsconfig.paths via tsconfig.json (baseUrl + paths).
  tsconfig: "tsconfig.json",
});
