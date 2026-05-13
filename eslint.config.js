// ESLint 9 flat config — TypeScript strict sem regras de formatação tarefeiras.
import eslint from "@eslint/js";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";

export default [
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "build/**",
      ".aios/**",
      "prisma/migrations/**",
      "evals/**/cases/**",
      "docs/**",
      "templates/**",
      "aios/**",
      "scripts/**",
      "*.config.ts",
      "*.config.js",
    ],
  },
  eslint.configs.recommended,
  {
    files: ["src/**/*.ts", "tests/**/*.ts", "evals/run.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        // Não usa project: true para evitar custo alto + falsos positivos em arquivos não no tsconfig.
      },
      globals: {
        // Globals de Node (process, console, Buffer, etc.)
        process: "readonly",
        console: "readonly",
        Buffer: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        fetch: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        setImmediate: "readonly",
        clearImmediate: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        global: "readonly",
        globalThis: "readonly",
        module: "readonly",
        require: "readonly",
        exports: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      // Bloquear apenas erros reais; formatação fica com prettier.
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      "no-undef": "off", // TS já cobre isso e pega ruído em type-only refs
      "no-redeclare": "off",
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-constant-condition": ["error", { checkLoops: false }],
      "no-prototype-builtins": "off",
      "no-control-regex": "off", // bench/parsing aceita
      "no-useless-escape": "off",
      "no-case-declarations": "off",
      "no-inner-declarations": "off",
      "no-async-promise-executor": "off",
      "@typescript-eslint/no-explicit-any": "off", // tsconfig já força tipos fortes
      "@typescript-eslint/ban-ts-comment": [
        "error",
        {
          "ts-expect-error": "allow-with-description",
          "ts-ignore": "allow-with-description",
          "ts-nocheck": true,
          "ts-check": false,
        },
      ],
    },
  },
];
