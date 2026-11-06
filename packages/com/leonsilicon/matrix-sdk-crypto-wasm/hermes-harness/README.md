# @-/com.leonsilicon.matrix-sdk-crypto-wasm.hermes-harness

Tests [`react-native-matrix-sdk-crypto-wasm`](../../../../../npm/react-native-matrix-sdk-crypto-wasm/README.md) in Hermes without an app. `harness.cpp` embeds Hermes through JSI, the same API the React Native runtime uses. It installs the package's bridge (`cpp/Wasm2cBridge.cpp` and the generated C), then evaluates a bundle of `bench-entry.ts` that loads the glue through the package's own `loader.js`.

```sh
vpr build:crypto   # once, and after every upstream bump
vpr test:hermes
```

The bundle runs three checks on the bridge, each covering a path that a plain benchmark would not reach:

- a JS exception thrown inside the module (Rust's `__wbindgen_throw`) unwinds through the module's C frames, and the module keeps working afterwards
- linear memory grows past its initial 1.5 MB, and the patched glue reads through the new buffer
- a trap (Rust aborting on an impossible allocation) becomes a `RuntimeError` instead of killing the process

It then runs the benchmark: an Olm session, Megolm encrypt and decrypt, and a 1 MiB attachment. The flow and the fixtures in `@fixtures/` come from upstream's `tests/machine.test.ts` (Apache-2.0).

Hermes is the version React Native 0.88 ships (`HERMES_TAG` in `hermes.ts`). It is cloned and built into `.cache/` on first run. To use an existing build, set `HERMES_SRC_DIR` and `HERMES_BUILD_DIR`; the build needs the `hermesvm` and `jsi` targets.
