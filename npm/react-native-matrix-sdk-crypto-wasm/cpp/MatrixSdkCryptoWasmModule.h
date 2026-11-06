#pragma once

#include <MatrixSdkCryptoWasmSpecJSI.h>

#include <memory>

namespace facebook::react {

class MatrixSdkCryptoWasmModule : public NativeMatrixSdkCryptoWasmCxxSpec<MatrixSdkCryptoWasmModule> {
 public:
  explicit MatrixSdkCryptoWasmModule(std::shared_ptr<CallInvoker> jsInvoker);

  bool install(jsi::Runtime& rt);
};

} // namespace facebook::react
