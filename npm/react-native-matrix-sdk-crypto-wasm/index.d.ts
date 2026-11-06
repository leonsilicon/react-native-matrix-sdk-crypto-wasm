// The same declarations as @matrix-org/matrix-sdk-crypto-wasm's index.d.ts: wasm-bindgen's
// generated types, plus initAsync. (`.js` resolves to the generated .d.ts; see the upstream file
// for why it is written this way.)
export * from "./types/matrix_sdk_crypto_wasm.js";

/**
 * Instantiates the native module, if it has not been already. Resolves once the other exports
 * are ready. `url` exists for compatibility with the upstream signature and is ignored.
 */
export declare function initAsync(url?: URL | string): Promise<void>;
