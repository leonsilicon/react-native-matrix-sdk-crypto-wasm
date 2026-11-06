// Runs the wasm2c-compiled matrix-sdk-crypto module behind an object that looks, to the
// wasm-bindgen glue, like the `exports` of a WebAssembly.Instance: one function per wasm export
// plus `memory.buffer`. generated/c/jsi-bindings.cpp supplies the per-function thunks; this file
// is the part that does not depend on the module's interface.

#pragma once

#include <jsi/jsi.h>

#include <cmath>
#include <cstddef>
#include <cstdint>
#include <memory>
#include <optional>
#include <vector>

#include "wasm-rt.h"
#include "wasm2c-trap.h"

namespace matrixsdkcryptowasm {

namespace jsi = facebook::jsi;

class Bridge;

using ExportThunk = jsi::Value (*)(Bridge&, jsi::Runtime&, const jsi::Value*, size_t);

struct ExportEntry {
  const char* name;
  unsigned paramCount;
  ExportThunk thunk;
};

// Defined in generated/c/jsi-bindings.cpp.
namespace generated {
struct Instance;
Instance* instantiate(Bridge& bridge);
void destroy(Instance* instance);
wasm_rt_memory_t* memory(Instance* instance);
extern const char* const kImportModule;
extern const size_t kImportCount;
extern const char* const kImportNames[];
extern const size_t kExportCount;
extern const ExportEntry kExports[];
} // namespace generated

// Conversions follow the JS API spec's ToJSValue / ToWebAssemblyValue, so the glue sees exactly
// what a real WebAssembly instance would give it.

inline jsi::Value wasmToJs(jsi::Runtime&, uint32_t value) {
  return jsi::Value(static_cast<double>(static_cast<int32_t>(value)));
}
inline jsi::Value wasmToJs(jsi::Runtime& rt, uint64_t value) {
  return jsi::BigInt::fromInt64(rt, static_cast<int64_t>(value));
}
inline jsi::Value wasmToJs(jsi::Runtime&, float value) {
  return jsi::Value(static_cast<double>(value));
}
inline jsi::Value wasmToJs(jsi::Runtime&, double value) {
  return jsi::Value(value);
}

uint32_t jsToU32(jsi::Runtime& rt, const jsi::Value& value);
uint64_t jsToU64(jsi::Runtime& rt, const jsi::Value& value);
double jsToF64(jsi::Runtime& rt, const jsi::Value& value);
inline float jsToF32(jsi::Runtime& rt, const jsi::Value& value) {
  return static_cast<float>(jsToF64(rt, value));
}

// A missing argument is `undefined`, as in a call to a real exported function.
inline uint32_t argToU32(jsi::Runtime& rt, const jsi::Value* args, size_t count, size_t index) {
  return index < count ? jsToU32(rt, args[index]) : 0;
}
inline uint64_t argToU64(jsi::Runtime& rt, const jsi::Value* args, size_t count, size_t index) {
  if (index < count) return jsToU64(rt, args[index]);
  return jsToU64(rt, jsi::Value::undefined()); // throws, as ToBigInt64(undefined) does
}
inline float argToF32(jsi::Runtime& rt, const jsi::Value* args, size_t count, size_t index) {
  return index < count ? jsToF32(rt, args[index]) : NAN;
}
inline double argToF64(jsi::Runtime& rt, const jsi::Value* args, size_t count, size_t index) {
  return index < count ? jsToF64(rt, args[index]) : NAN;
}

class Bridge {
 public:
  /// Instantiates the module against `imports` (the glue module's namespace, which holds every
  /// import function by name) and returns the exports object to pass to `__wbg_set_wasm`.
  static jsi::Object instantiate(jsi::Runtime& rt, const jsi::Object& imports);

  Bridge(const Bridge&) = delete;
  Bridge& operator=(const Bridge&) = delete;

  jsi::Runtime& runtime() {
    return rt_;
  }
  generated::Instance* instance() {
    return instance_.get();
  }

  /// Called by the generated import definitions, from inside the module.
  jsi::Value callImport(size_t index, const jsi::Value* args, size_t count);

  /// Runs `call` (a call into the module) inside a trap frame, and turns a trap into a JS error.
  template <typename Call>
  void invoke(jsi::Runtime& rt, Call&& call);

 private:
  explicit Bridge(jsi::Runtime& rt) : rt_(rt) {}
  void syncMemory();
  [[noreturn]] void throwTrap(wasm_rt_trap_t code);

  jsi::Runtime& rt_;
  // Shared with every ArrayBuffer over linear memory, so memory outlives the buffers.
  std::shared_ptr<generated::Instance> instance_;
  std::vector<jsi::Function> imports_;
  std::optional<jsi::Object> memoryObject_;
  uint8_t* memoryData_ = nullptr;
  uint64_t memorySize_ = 0;
};

namespace detail {
struct TrapScope {
  mxcw_trap_frame frame;
  TrapScope() {
    mxcw_trap_enter(&frame);
  }
  ~TrapScope() {
    mxcw_trap_leave(&frame);
  }
  TrapScope(const TrapScope&) = delete;
  TrapScope& operator=(const TrapScope&) = delete;
};
} // namespace detail

template <typename Call>
void Bridge::invoke(jsi::Runtime&, Call&& call) {
  // A trap long-jumps back here, skipping only the module's C frames (and `call` itself, which
  // holds nothing that needs destroying). The scope's destructor runs either way.
  detail::TrapScope scope;
  if (MXCW_SETJMP(scope.frame.buffer) == 0) {
    call();
  } else {
    syncMemory();
    throwTrap(scope.frame.code);
  }
  // Memory may have grown during the call; publish the longer buffer before JS reads it.
  syncMemory();
}

/// Defines `globalThis.__matrixSdkCryptoWasm2c = { instantiate(imports) }`.
void install(jsi::Runtime& rt);

} // namespace matrixsdkcryptowasm
