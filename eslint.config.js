import js from "@eslint/js";
import gitignore from "eslint-config-flat-gitignore";
import globals from "globals";
import eslintConfigPrettier from "eslint-config-prettier";

export default [
  gitignore(),
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
      },
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: "module",
      },
    },
  },
  js.configs.recommended,
  eslintConfigPrettier,
];
