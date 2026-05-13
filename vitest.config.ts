import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      // Thresholds desligados por enquanto — testes mínimos focados em risco.
      // Quando a suíte crescer, ativar:
      //   thresholds: { lines: 60, functions: 60, branches: 50, statements: 60 }
      include: [
        "src/ingest/normalize.ts",
        "src/ingest/parsers/text.ts",
        "src/ingest/parsers/excel.ts",
        "src/dre-narrative/aggregator.ts",
        "src/auth/middleware.ts",
        "src/classification/classifier.ts",
        "src/action-plan/generator.ts",
        "src/export/predicates.ts",
      ],
      exclude: ["node_modules", "dist", "build", ".aios", "evals", "scripts"],
    },
  },
});
