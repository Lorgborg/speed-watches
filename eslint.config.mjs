// @ts-check
// Flat config for ESLint v9 + typescript-eslint.
// `eslint.configs.recommended` = built-in JS rules.
// `tseslint.configs.recommended` = TypeScript-aware rules (no type info needed).
import eslint from "@eslint/js"
import tseslint from "typescript-eslint"
import stylistic from "@stylistic/eslint-plugin"

export default tseslint.config(
  {
    ignores: ["node_modules/**", "coverage/**", "test.ts", "data.json", "sample.json"],
  },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  {
    plugins: {
      "@stylistic": stylistic,
    },
    rules: {
      // Indentation: 2 spaces, no tabs. Autofixable — run `eslint . --fix`.
      "@stylistic/indent": ["error", 2, { "SwitchCase": 1 }],
      // `any` is a crutch — warn so it's visible without blocking everything.
      "@typescript-eslint/no-explicit-any": "warn",
      // routes/index.ts deliberately uses require() to load route files at runtime.
      "@typescript-eslint/no-require-imports": "off",
      // TypeScript already catches undefined-variable bugs at typecheck time.
      "no-undef": "off",
    },
  },
)
