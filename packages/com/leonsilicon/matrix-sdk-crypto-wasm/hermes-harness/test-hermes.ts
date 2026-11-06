import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

import { build } from "esbuild";

import { ensureHermes, run } from "#hermes";

const harnessDir = import.meta.dirname;
const repoRoot = resolve(harnessDir, "../../../../..");
const cacheDir = join(repoRoot, ".cache");
const packageDir = join(repoRoot, "npm/react-native-matrix-sdk-crypto-wasm");

/** Builds the harness against a Hermes build, runs the checks and benchmark, returns the exit code. */
export async function testHermes(): Promise<number> {
  if (!existsSync(join(packageDir, "generated", "c", "jsi-bindings.cpp"))) {
    throw new Error("Nothing to test yet: run `vpr build:crypto` first.");
  }
  const hermes = ensureHermes(cacheDir);
  const outDir = join(cacheDir, "hermes-harness");
  mkdirSync(outDir, { recursive: true });

  const bundle = join(outDir, "bundle.js");
  await build({
    entryPoints: [join(harnessDir, "bench-entry.ts")],
    bundle: true,
    format: "iife",
    target: "es2020",
    platform: "neutral",
    mainFields: ["module", "main"],
    outfile: bundle,
    logLevel: "warning",
  });

  const buildDir = join(outDir, "build");
  run("cmake", [
    "-S",
    harnessDir,
    "-B",
    buildDir,
    "-G",
    "Ninja",
    "-DCMAKE_BUILD_TYPE=Release",
    `-DHERMES_SRC_DIR=${hermes.srcDir}`,
    `-DHERMES_BUILD_DIR=${hermes.buildDir}`,
    `-DPACKAGE_DIR=${packageDir}`,
  ]);
  run("ninja", ["-C", buildDir]);

  const result = spawnSync(join(buildDir, "matrix-sdk-crypto-wasm-hermes-harness"), [bundle], {
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  return result.status ?? 1;
}
