// The entry point's loading logic, shared by the React Native entry (index.js) and the Hermes
// test harness. It mirrors the upstream package's own loader (index.mjs), except that instead of
// fetching and instantiating a .wasm file it asks the native module for an instance.

const NOT_INITIALIZED = new Proxy(
  {},
  {
    get() {
      throw new Error(
        "react-native-matrix-sdk-crypto-wasm was used before it was initialized. Call `initAsync` first.",
      );
    },
  },
);

/**
 * @param {Record<string, unknown> & { __wbg_set_wasm(exports: unknown): void }} bindings the glue module
 * @param {() => void} installNative defines globalThis.__matrixSdkCryptoWasm2c
 * @returns {(url?: URL | string) => Promise<void>}
 */
export function createInitAsync(bindings, installNative) {
  bindings.__wbg_set_wasm(NOT_INITIALIZED);
  /** @type {Promise<void> | null} */
  let ready = null;
  // `url` is the upstream signature's .wasm location; there is no .wasm file here.
  return function initAsync(_url) {
    ready ??= Promise.resolve().then(() => {
      if (!globalThis.__matrixSdkCryptoWasm2c) installNative();
      const host = globalThis.__matrixSdkCryptoWasm2c;
      if (!host) {
        throw new Error(
          "react-native-matrix-sdk-crypto-wasm: the native module did not install itself",
        );
      }
      const exports = host.instantiate(bindings);
      bindings.__wbg_set_wasm(exports);
      exports.__wbindgen_start();
    });
    return ready;
  };
}
