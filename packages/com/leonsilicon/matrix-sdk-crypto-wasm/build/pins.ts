// Every version the build depends on, in one place. Changing one of these changes the
// generated C, so bump them together and rebuild.

/** The upstream crate tag. matrix-js-sdk 45 depends on exactly this version. */
export const UPSTREAM_TAG = "v18.9.0";

/** Nightly is needed for `-Z build-std`, which rebuilds std without reference types or multivalue. */
export const RUST_TOOLCHAIN = "nightly-2026-09-15";

/** wasm2c's output and runtime change between releases, so the build refuses any other version. */
export const WABT_VERSION = "1.0.42";

/**
 * Upper bound of the module's linear memory. wasm2c reserves this much address space up front
 * (without committing it) so the memory never moves when it grows, which keeps every
 * `ArrayBuffer` handed to JavaScript valid.
 */
export const WASM_MAX_MEMORY_BYTES = 1024 * 1024 * 1024;

/** Prefix of every symbol wasm2c emits (`w2c_<name>_...`). Kept short and unlikely to collide. */
export const WASM2C_MODULE_NAME = "mxcrypto";

/** The C is split so a build can compile it in parallel. */
export const WASM2C_NUM_OUTPUTS = 16;
