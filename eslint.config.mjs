import tseslint from "typescript-eslint";
import nextPlugin from "@next/eslint-plugin-next";
import { noForbiddenRuntimeImports } from "./scripts/eslint-boundaries.mjs";

export default [
  { ignores: ["node_modules/**", ".next/**", "evals/reports/**", "coverage/**"] },
  { files: ["**/*.{ts,tsx}"], languageOptions: { parser: tseslint.parser, parserOptions: { ecmaVersion: "latest", sourceType: "module" } }, plugins: { boundaries: { rules: { "no-forbidden-runtime-imports": noForbiddenRuntimeImports } }, "@next/next": nextPlugin }, rules: { ...nextPlugin.configs.recommended.rules, "boundaries/no-forbidden-runtime-imports": "error" } }
];
