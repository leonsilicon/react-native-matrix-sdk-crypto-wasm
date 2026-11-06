import { TurboModuleRegistry, type TurboModule } from "react-native";

export interface Spec extends TurboModule {
  /** Defines `globalThis.__matrixSdkCryptoWasm2c` on the JS runtime. Synchronous. */
  install(): boolean;
}

export default TurboModuleRegistry.getEnforcing<Spec>("MatrixSdkCryptoWasm");
