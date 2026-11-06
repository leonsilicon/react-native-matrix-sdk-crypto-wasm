import { defineConfig } from "vite-plus";
import flatcap from "eslint-plugin-flatcap";

const base = "packages/com/leonsilicon/matrix-sdk-crypto-wasm";

export default defineConfig({
  lint: {
    ...flatcap.configs.oxlint,
    options: { typeAware: true, typeCheck: true },
    ignorePatterns: [
      "npm/react-native-matrix-sdk-crypto-wasm/generated/**",
      // A React Native codegen spec: React Native's codegen validates it when an app builds,
      // and this workspace does not install react-native.
      "npm/react-native-matrix-sdk-crypto-wasm/src/**",
      "**/@upstream/**",
    ],
    overrides: [
      {
        // node:test registers top-level tests through promises managed by its runner.
        files: ["**/__tests__/**"],
        rules: { "typescript/no-floating-promises": "off" },
      },
    ],
  },
  fmt: {
    ignorePatterns: [
      "npm/react-native-matrix-sdk-crypto-wasm/generated/**",
      "npm/react-native-matrix-sdk-crypto-wasm/types/**",
      "**/@upstream/**",
    ],
  },
  run: {
    tasks: {
      "build:crypto": {
        cache: false,
        command: `node ${base}/build/_build-crypto.ts`,
      },
      "test:hermes": {
        cache: false,
        command: `node ${base}/hermes-harness/_test-hermes.ts`,
      },
      test: {
        cache: false,
        command: `node --test ${base}/build/__tests__/*.test.ts`,
      },
      typecheck: { command: "tsc --noEmit" },
    },
  },
});
