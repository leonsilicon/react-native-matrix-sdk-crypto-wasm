// The bundle harness.cpp evaluates. harness.cpp installs the native module before this runs, the
// same way the React Native TurboModule does on first use.

import "#harness-env";

import * as glue from "react-native-matrix-sdk-crypto-wasm/glue";
import { createInitAsync } from "react-native-matrix-sdk-crypto-wasm/loader";

import { bridgeChecks, runBench } from "#bench";

declare global {
  var __matrixSdkCryptoWasm2c: { instantiate(glue: unknown): Record<string, unknown> };
}

const print = globalThis.__harnessPrint;
const now = (): number => performance.now();

async function main(): Promise<void> {
  const initAsync = createInitAsync(glue, () => {
    throw new Error("the harness should have installed the native module");
  });
  let start = now();
  await initAsync();
  print(`initAsync ${(now() - start).toFixed(2)} ms`);

  let failed = 0;
  for (const check of bridgeChecks(glue, (bindings) =>
    globalThis.__matrixSdkCryptoWasm2c.instantiate(bindings),
  )) {
    try {
      await check.run();
      print(`ok   ${check.name}`);
    } catch (error) {
      failed++;
      print(
        `FAIL ${check.name}\n     ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`,
      );
    }
  }

  start = now();
  const result = await runBench(glue, now);
  print(`bench (${(now() - start).toFixed(0)} ms total)`);
  for (const [name, ms] of Object.entries(result))
    print(`  ${name.padEnd(26)} ${ms.toFixed(3)} ms`);

  globalThis.__harnessExitCode = failed === 0 ? 0 : 1;
}

main().catch((error: unknown) => {
  print(`FAIL ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`);
  globalThis.__harnessExitCode = 1;
});
