import { spawnSync, type SpawnSyncOptions } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";

import { cacheDir, upstreamDir } from "#paths";
import { RUST_TOOLCHAIN, WABT_VERSION } from "#pins";

export function run(command: string, args: string[], options: SpawnSyncOptions = {}): void {
  console.log(`$ ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, { stdio: "inherit", ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} exited with ${result.status ?? result.signal}`);
  }
}

export function capture(
  command: string,
  args: string[],
  options: SpawnSyncOptions = {},
): string | null {
  const result = spawnSync(command, args, { encoding: "utf8", ...options });
  if (result.error || result.status !== 0) return null;
  return String(result.stdout).trim();
}

function which(command: string): string | null {
  return capture("sh", ["-c", `command -v ${command}`]);
}

export function ensureRustToolchain(): void {
  // Idempotent: rustup only downloads what is missing.
  run("rustup", [
    "toolchain",
    "install",
    RUST_TOOLCHAIN,
    "--profile",
    "minimal",
    "--component",
    "rust-src",
    "--target",
    "wasm32-unknown-unknown",
  ]);
}

export interface WasmCCompiler {
  cc: string;
  ar: string;
}

/**
 * `ring` compiles C for wasm32, which Apple's clang cannot target. Use `WASM_CC`/`WASM_AR` when
 * set, otherwise the first clang with a wasm32 backend (Homebrew LLVM on macOS, distro clang on
 * Linux) and the `llvm-ar` next to it.
 */
export function findWasmCCompiler(): WasmCCompiler {
  const candidates = [
    process.env.WASM_CC,
    "/opt/homebrew/opt/llvm/bin/clang",
    "/usr/local/opt/llvm/bin/clang",
    which("clang"),
  ].filter((path): path is string => Boolean(path));
  for (const cc of candidates) {
    if (!existsSync(cc)) continue;
    if (!capture(cc, ["--print-targets"])?.includes("wasm32")) continue;
    const ar = process.env.WASM_AR ?? join(dirname(cc), "llvm-ar");
    if (!existsSync(ar)) continue;
    return { cc, ar };
  }
  throw new Error(
    "No clang with a wasm32 target was found. Install LLVM (`brew install llvm`, or `apt install clang llvm`) " +
      "or set WASM_CC and WASM_AR.",
  );
}

/** wasm-bindgen's CLI must match the `wasm-bindgen` crate version in the upstream Cargo.lock. */
export function lockedWasmBindgenVersion(): string {
  const lock = readFileSync(join(upstreamDir, "Cargo.lock"), "utf8");
  const match = /\[\[package\]\]\nname = "wasm-bindgen"\nversion = "([^"]+)"/.exec(lock);
  if (!match) throw new Error("wasm-bindgen is not in the upstream Cargo.lock");
  return match[1];
}

export function ensureWasmBindgen(version: string): string {
  const root = join(cacheDir, "tools");
  const bin = join(root, "bin", "wasm-bindgen");
  if (capture(bin, ["--version"]) === `wasm-bindgen ${version}`) return bin;
  run("cargo", ["install", "wasm-bindgen-cli", "--version", version, "--locked", "--root", root]);
  return bin;
}

export interface Wabt {
  wasm2c: string;
  /** wasm-rt.h and friends. */
  includeDir: string;
  /** wasm-rt-impl.c and the other runtime sources. */
  runtimeDir: string;
}

/** Uses `WABT_DIR` (an extracted wabt release) or the `wasm2c` on PATH. */
export function findWabt(): Wabt {
  const wasm2c = process.env.WABT_DIR
    ? join(process.env.WABT_DIR, "bin", "wasm2c")
    : which("wasm2c");
  if (!wasm2c || !existsSync(wasm2c)) {
    throw new Error(
      `wasm2c was not found. Install wabt ${WABT_VERSION} (\`brew install wabt\`) or set WABT_DIR.`,
    );
  }
  const version = capture(wasm2c, ["--version"]);
  if (version !== WABT_VERSION) {
    throw new Error(
      `wasm2c ${version} found at ${wasm2c}, but the build is pinned to wabt ${WABT_VERSION}.`,
    );
  }
  const prefix = dirname(dirname(realpathSync(wasm2c)));
  const includeDir = join(prefix, "include");
  const runtimeDir = join(prefix, "share", "wabt", "wasm2c");
  for (const file of [join(includeDir, "wasm-rt.h"), join(runtimeDir, "wasm-rt-impl.c")]) {
    if (!existsSync(file)) throw new Error(`wabt at ${prefix} is missing ${file}`);
  }
  return { wasm2c, includeDir, runtimeDir };
}
