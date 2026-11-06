import { spawnSync, type SpawnSyncOptions } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

/** The Hermes React Native 0.88 ships (react-native/sdks/hermes-engine/version.properties). */
export const HERMES_TAG = "hermes-v260318099.0.5";

export function run(command: string, args: string[], options: SpawnSyncOptions = {}): void {
  console.log(`$ ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, { stdio: "inherit", ...options });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`${command} exited with ${result.status ?? result.signal}`);
}

export interface HermesBuild {
  srcDir: string;
  buildDir: string;
}

/**
 * Uses HERMES_SRC_DIR and HERMES_BUILD_DIR when both are set (any Hermes build with the
 * `hermesvm` and `jsi` targets built). Otherwise clones HERMES_TAG into the cache and builds it,
 * which takes a few minutes the first time.
 */
export function ensureHermes(cacheDir: string): HermesBuild {
  const { HERMES_SRC_DIR, HERMES_BUILD_DIR } = process.env;
  if (HERMES_SRC_DIR && HERMES_BUILD_DIR)
    return { srcDir: HERMES_SRC_DIR, buildDir: HERMES_BUILD_DIR };

  const root = join(cacheDir, "hermes", HERMES_TAG);
  const srcDir = join(root, "src");
  const buildDir = join(root, "build");
  if (!existsSync(join(srcDir, "CMakeLists.txt"))) {
    mkdirSync(root, { recursive: true });
    run("git", [
      "clone",
      "--depth",
      "1",
      "--branch",
      HERMES_TAG,
      "https://github.com/facebook/hermes.git",
      srcDir,
    ]);
  }
  if (!existsSync(join(buildDir, "build.ninja"))) {
    run("cmake", [
      "-S",
      srcDir,
      "-B",
      buildDir,
      "-G",
      "Ninja",
      "-DCMAKE_BUILD_TYPE=Release",
      "-DHERMES_ENABLE_TEST_SUITE=OFF",
    ]);
  }
  run("ninja", ["-C", buildDir, "hermesvm", "jsi"]);
  return { srcDir, buildDir };
}
