export declare function createInitAsync(
  bindings: { __wbg_set_wasm(exports: unknown): void },
  installNative: () => void,
): (url?: URL | string) => Promise<void>;
