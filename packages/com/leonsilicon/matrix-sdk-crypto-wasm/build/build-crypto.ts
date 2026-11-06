import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

import { patchGlue } from "#glue-patch";
import { generateJsiBindings } from "#jsi-bindings";
import { cacheDir, generatedDir, typesDir, upstreamDir } from "#paths";
import {
  RUST_TOOLCHAIN,
  UPSTREAM_TAG,
  WABT_VERSION,
  WASM2C_MODULE_NAME,
  WASM2C_NUM_OUTPUTS,
  WASM_MAX_MEMORY_BYTES,
} from "#pins";
import {
  capture,
  ensureRustToolchain,
  ensureWasmBindgen,
  findWabt,
  findWasmCCompiler,
  lockedWasmBindgenVersion,
  run,
} from "#toolchain";
import { parseWasm2cHeader } from "#wasm2c-header";

const CRATE = "matrix_sdk_crypto_wasm";

function checkUpstream(): string {
  if (!existsSync(join(upstreamDir, "Cargo.toml"))) {
    throw new Error("The upstream crate is missing. Run `git submodule update --init`.");
  }
  const tag = capture("git", ["-C", upstreamDir, "describe", "--tags", "--exact-match"]);
  if (tag !== UPSTREAM_TAG) {
    throw new Error(
      `@upstream is at ${tag ?? "an untagged commit"}, but the build is pinned to ${UPSTREAM_TAG}.`,
    );
  }
  return capture("git", ["-C", upstreamDir, "rev-parse", "HEAD"]) ?? "unknown";
}

/**
 * Builds the crate for the WebAssembly MVP feature set. Without reference types the glue keeps
 * JavaScript values in its own heap array and passes indices; without multivalue, results come
 * back through memory. The JS<->native boundary then carries only numbers.
 */
function cargoBuild(): string {
  const { cc, ar } = findWasmCCompiler();
  const targetDir = join(cacheDir, "cargo-target");
  run(
    "cargo",
    [
      `+${RUST_TOOLCHAIN}`,
      "build",
      "--release",
      "--target",
      "wasm32-unknown-unknown",
      "-Z",
      "build-std=std,panic_abort",
    ],
    {
      cwd: upstreamDir,
      env: {
        ...process.env,
        CARGO_TARGET_DIR: targetDir,
        CC_wasm32_unknown_unknown: cc,
        AR_wasm32_unknown_unknown: ar,
        CFLAGS_wasm32_unknown_unknown: "-mcpu=mvp",
        // RUSTFLAGS replaces the crate's own `[target.wasm32-unknown-unknown] rustflags`, so its
        // getrandom backend flag is repeated here.
        RUSTFLAGS: [
          "-C target-cpu=mvp",
          '--cfg getrandom_backend="wasm_js"',
          `-C link-arg=--max-memory=${WASM_MAX_MEMORY_BYTES}`,
        ].join(" "),
      },
    },
  );
  return join(targetDir, "wasm32-unknown-unknown", "release", `${CRATE}.wasm`);
}

export function buildCrypto(): void {
  const upstreamCommit = checkUpstream();
  ensureRustToolchain();
  const wasmBindgenVersion = lockedWasmBindgenVersion();
  const wasmBindgen = ensureWasmBindgen(wasmBindgenVersion);
  const wabt = findWabt();

  const rawWasm = cargoBuild();

  const bindgenDir = join(cacheDir, "bindgen");
  rmSync(bindgenDir, { recursive: true, force: true });
  run(wasmBindgen, ["--target", "bundler", "--weak-refs", "--out-dir", bindgenDir, rawWasm]);
  const wasm = join(bindgenDir, `${CRATE}_bg.wasm`);

  rmSync(generatedDir, { recursive: true, force: true });
  const cDir = join(generatedDir, "c");
  mkdirSync(cDir, { recursive: true });
  run(wabt.wasm2c, [
    wasm,
    "-n",
    WASM2C_MODULE_NAME,
    "--num-outputs",
    String(WASM2C_NUM_OUTPUTS),
    "-o",
    join(cDir, `${WASM2C_MODULE_NAME}.c`),
  ]);

  // The wasm2c runtime is compiled with the module, so it ships with it.
  const runtimeDir = join(cDir, "wasm-rt");
  mkdirSync(runtimeDir);
  for (const dir of [wabt.includeDir, wabt.runtimeDir]) {
    for (const file of readdirSync(dir)) {
      if (file.startsWith("wasm-rt")) cpSync(join(dir, file), join(runtimeDir, file));
    }
  }

  const header = readFileSync(join(cDir, `${WASM2C_MODULE_NAME}.h`), "utf8");
  const iface = parseWasm2cHeader(header, WASM2C_MODULE_NAME);
  const wasmSha256 = createHash("sha256").update(readFileSync(wasm)).digest("hex");
  writeFileSync(
    join(cDir, "jsi-bindings.cpp"),
    generateJsiBindings(iface, {
      moduleName: WASM2C_MODULE_NAME,
      headerName: `${WASM2C_MODULE_NAME}.h`,
      provenance: `matrix-sdk-crypto-wasm ${UPSTREAM_TAG} (${upstreamCommit}), wasm sha256 ${wasmSha256}`,
    }),
  );

  writeFileSync(
    join(generatedDir, `${CRATE}_bg.js`),
    patchGlue(readFileSync(join(bindgenDir, `${CRATE}_bg.js`), "utf8")),
  );
  // Committed (not under generated/), so an upstream bump shows its API changes in review.
  mkdirSync(typesDir, { recursive: true });
  cpSync(join(bindgenDir, `${CRATE}.d.ts`), join(typesDir, `${CRATE}.d.ts`));

  const buildInfo = {
    upstream: {
      repository: "https://github.com/matrix-org/matrix-sdk-crypto-wasm",
      tag: UPSTREAM_TAG,
      commit: upstreamCommit,
    },
    rustToolchain: RUST_TOOLCHAIN,
    rustc: capture("rustc", [`+${RUST_TOOLCHAIN}`, "--version"]),
    wasmBindgen: wasmBindgenVersion,
    wabt: WABT_VERSION,
    wasmSha256,
    wasmMaxMemoryBytes: WASM_MAX_MEMORY_BYTES,
    exports: iface.exports.length,
    imports: iface.imports.length,
  };
  writeFileSync(join(generatedDir, "build-info.json"), JSON.stringify(buildInfo, null, 2) + "\n");
  console.log(
    `Generated ${generatedDir}: ${iface.exports.length} exports, ${iface.imports.length} imports.`,
  );
}
