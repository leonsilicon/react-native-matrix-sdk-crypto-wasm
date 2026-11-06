# react-native-matrix-sdk-crypto-wasm

Runs matrix-js-sdk's Rust end-to-end encryption ([`@matrix-org/matrix-sdk-crypto-wasm`](https://github.com/matrix-org/matrix-sdk-crypto-wasm)) on React Native.

Hermes has no WebAssembly, so the crate's WebAssembly is translated to C with wasm2c and called through JSI. Upstream's JavaScript glue stays as it is, so matrix-js-sdk uses the package unchanged. The published package is [`npm/react-native-matrix-sdk-crypto-wasm`](npm/react-native-matrix-sdk-crypto-wasm/README.md).

## Layout

This is a [Flatcap](https://github.com/leonsilicon/flatcap) workspace (Bun, Vite+).

| Path                                                                                                                                         | What it is                                                                                     |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| [`npm/react-native-matrix-sdk-crypto-wasm`](npm/react-native-matrix-sdk-crypto-wasm/README.md)                                               | The npm package: the C++ TurboModule, the bridge runtime, the loader, and `generated/` (built) |
| [`packages/com/leonsilicon/matrix-sdk-crypto-wasm/build`](packages/com/leonsilicon/matrix-sdk-crypto-wasm/build/README.md)                   | Builds `generated/` from the upstream crate (`@upstream`, a submodule pinned in `pins.ts`)     |
| [`packages/com/leonsilicon/matrix-sdk-crypto-wasm/hermes-harness`](packages/com/leonsilicon/matrix-sdk-crypto-wasm/hermes-harness/README.md) | Runs the bridge in Hermes through JSI without an app: checks and a benchmark                   |

## Commands

```sh
git submodule update --init
vp install
vpr build:crypto   # build generated/ (Rust, wasm-bindgen, wasm2c, bindings)
vpr test:hermes    # compile the bridge against Hermes and run the checks and benchmark
vpr test           # unit tests for the build's parser, code generator and glue patch
vp check           # format, lint (Flatcap rules), typecheck
```

`build:crypto` needs rustup, a clang with a wasm32 target (Homebrew `llvm`), and wabt at the pinned version (`brew install wabt`). The build package's README lists the details.

## Updating upstream

1. Check out the new tag in `packages/com/leonsilicon/matrix-sdk-crypto-wasm/build/@upstream` and set `UPSTREAM_TAG` in `pins.ts`. Use the version the matrix-js-sdk you target depends on; it pins an exact version.
2. `vpr build:crypto && vpr test:hermes`.
3. Review the diff in `npm/react-native-matrix-sdk-crypto-wasm/types/`: it is the API change.
4. Bump the npm package version and the compatibility table in its README.

The build stops with an error, rather than shipping something subtly wrong, if:

- the glue's memory caches change shape (`glue-patch.ts`)
- the module starts using a value type the bridge cannot pass (`wasm2c-header.ts`)
- the glue no longer provides an import the C expects (at instantiation)
