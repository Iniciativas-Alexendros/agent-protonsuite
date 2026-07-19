import tseslint from "typescript-eslint";
import js from "@eslint/js";
import importX from "eslint-plugin-import-x";
import unicorn from "eslint-plugin-unicorn";
import security from "eslint-plugin-security";

const plugins = { unicorn, security, "import-x": importX };

const sharedRules = {
  "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
  "@typescript-eslint/consistent-type-imports": "error",
  "@typescript-eslint/no-unsafe-assignment": "off",
  "@typescript-eslint/no-unsafe-member-access": "off",
  "@typescript-eslint/no-unsafe-call": "off",
  "@typescript-eslint/no-unsafe-return": "off",
  "@typescript-eslint/restrict-template-expressions": "off",
  "@typescript-eslint/switch-exhaustiveness-check": "error",
  "unicorn/prefer-node-protocol": "error",
  "security/detect-object-injection": "off",
  "import-x/order": ["warn", {
    groups: ["builtin", "external", "internal", "parent", "sibling"],
    "newlines-between": "never",
    alphabetize: { order: "asc" },
  }],
};

export default tseslint.config(
  { ignores: ["dist/", "node_modules/", "coverage/", ".husky/", "eslint.config.mjs", "commitlint.config.mjs", "knip.config.mjs", "vitest.config.ts", "vitest.e2e.config.ts"] },
  js.configs.recommended,

  // src/ files — main tsconfig
  {
    files: ["src/**/*.ts"],
    extends: [...tseslint.configs.strictTypeChecked, ...tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins,
    rules: {
      ...sharedRules,
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/no-deprecated": "warn",
      "@typescript-eslint/no-base-to-string": "error",
      "@typescript-eslint/prefer-nullish-coalescing": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unnecessary-condition": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/require-await": "error",
      "@typescript-eslint/no-unnecessary-type-conversion": "warn",
      "@typescript-eslint/no-unnecessary-type-assertion": "warn",
      "@typescript-eslint/restrict-plus-operands": "off",
      "@typescript-eslint/consistent-type-imports": ["warn", { fixStyle: "inline-type-imports" }],
      "no-useless-escape": "warn",
    },
  },

  // tests/ and root config files — relaxed tsconfig
  {
    files: ["tests/**/*.ts", "vitest.config.ts", "vitest.e2e.config.ts", "eslint.config.mjs", "commitlint.config.mjs", "knip.config.mjs"],
    extends: [...tseslint.configs.strictTypeChecked, ...tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.eslint.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins,
    rules: {
      ...sharedRules,
      "@typescript-eslint/no-floating-promises": "off",
      "@typescript-eslint/no-misused-promises": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unnecessary-type-assertion": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unnecessary-condition": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-deprecated": "warn",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/restrict-plus-operands": "off",
      "@typescript-eslint/no-empty-function": "off",
      "@typescript-eslint/no-dynamic-delete": "off",
      "@typescript-eslint/no-redundant-type-constituents": "off",
      "@typescript-eslint/use-unknown-in-catch-callback-variable": "off",
      "@typescript-eslint/array-type": "off",
    },
  },
);
