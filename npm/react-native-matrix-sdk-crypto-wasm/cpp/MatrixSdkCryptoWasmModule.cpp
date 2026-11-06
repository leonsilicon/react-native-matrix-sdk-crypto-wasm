#include "MatrixSdkCryptoWasmModule.h"

#include "Wasm2cBridge.h"

namespace facebook::react {

MatrixSdkCryptoWasmModule::MatrixSdkCryptoWasmModule(std::shared_ptr<CallInvoker> jsInvoker)
    : NativeMatrixSdkCryptoWasmCxxSpec(std::move(jsInvoker)) {}

bool MatrixSdkCryptoWasmModule::install(jsi::Runtime& rt) {
  matrixsdkcryptowasm::install(rt);
  return true;
}

} // namespace facebook::react
