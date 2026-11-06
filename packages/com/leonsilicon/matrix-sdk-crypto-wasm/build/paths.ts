import { join, resolve } from "node:path";

export const buildPackageDir = import.meta.dirname;
export const repoRoot = resolve(buildPackageDir, "../../../../..");
export const upstreamDir = join(buildPackageDir, "@upstream");
export const cacheDir = join(repoRoot, ".cache");
export const npmPackageDir = join(repoRoot, "npm/react-native-matrix-sdk-crypto-wasm");
/** Build output that ships in the npm tarball. Ignored by git. */
export const generatedDir = join(npmPackageDir, "generated");
/** The generated TypeScript declarations, which are committed. */
export const typesDir = join(npmPackageDir, "types");
