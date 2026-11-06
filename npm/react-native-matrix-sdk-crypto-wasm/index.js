// React Native entry point: a drop-in for @matrix-org/matrix-sdk-crypto-wasm. The classes and
// functions are the upstream wasm-bindgen glue, unchanged apart from glue-patch.ts; only where
// the WebAssembly instance comes from differs.

import { TurboModuleRegistry } from "react-native";

import * as bindings from "./generated/matrix_sdk_crypto_wasm_bg.js";
import { createInitAsync } from "./loader.js";

export * from "./generated/matrix_sdk_crypto_wasm_bg.js";

// The crypto store finds IndexedDB through matrix_indexed_db_futures, which looks for the factory
// on globalThis.Window, globalThis.WorkerGlobalScope or globalThis.global. React Native has none
// of those as properties (Metro passes `global` to each module as a variable), so define the
// Node-style one. Without it, opening a persistent store fails with "Unsupported environment".
globalThis.global ??= globalThis;

export const initAsync = createInitAsync(bindings, () => {
  TurboModuleRegistry.getEnforcing("MatrixSdkCryptoWasm").install();
});
