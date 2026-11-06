# @-/com.leonsilicon.matrix-sdk-crypto-wasm.build

Builds the `generated/` directory of [`react-native-matrix-sdk-crypto-wasm`](../../../../../npm/react-native-matrix-sdk-crypto-wasm/README.md) from the upstream crate in `@upstream` (a git submodule of [matrix-org/matrix-sdk-crypto-wasm](https://github.com/matrix-org/matrix-sdk-crypto-wasm), pinned in `pins.ts`).

```sh
vpr build:crypto   # or: node packages/com/leonsilicon/matrix-sdk-crypto-wasm/build/_build-crypto.ts
```

## Steps

1. `cargo +nightly build -Z build-std` for `wasm32-unknown-unknown` with `-C target-cpu=mvp`. Rust enables reference types and multivalue by default; turning them off makes wasm-bindgen keep JavaScript values in the glue's own heap and return results through memory, so the native bridge only ever passes numbers. `--max-memory` caps linear memory, because wasm2c reserves that much address space up front.
2. `wasm-bindgen --target bundler --weak-refs`, at the version in the upstream `Cargo.lock`.
3. `wasm2c -n mxcrypto --num-outputs 16`, plus a copy of the wasm2c runtime from the same wabt.
4. `jsi-bindings.ts` reads the wasm2c header (`wasm2c-header.ts`) and writes `jsi-bindings.cpp`: a JSI thunk per export, and a definition per import that calls the glue.
5. `glue-patch.ts` makes the glue's memory caches compare buffer identity. Without this, they would keep using a too-short view after the memory grows.
6. `build-info.json` records the versions and the wasm hash.

## Requirements

- rustup (the pinned nightly, `rust-src` and the wasm32 target are installed automatically)
- a clang with a wasm32 backend and `llvm-ar`, for `ring`'s C code: Homebrew `llvm` on macOS, or set `WASM_CC` and `WASM_AR`
- wabt at exactly the pinned version: `brew install wabt`, or set `WABT_DIR` to an extracted release
