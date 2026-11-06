#include "Wasm2cBridge.h"

#include <cstdlib>
#include <mutex>
#include <string>
#include <utility>

namespace matrixsdkcryptowasm {

namespace {

// ToInt32, then reinterpreted as the unsigned bits wasm2c passes around.
uint32_t doubleToU32(double value) {
  if (!std::isfinite(value)) return 0;
  double wrapped = std::fmod(std::trunc(value), 4294967296.0);
  if (wrapped < 0) wrapped += 4294967296.0;
  return static_cast<uint32_t>(wrapped);
}

// Linear memory as an ArrayBuffer. wasm2c's mmap allocation never moves the memory when it
// grows, so a buffer stays valid; it just covers the size the memory had when it was made.
class LinearMemoryBuffer final : public jsi::MutableBuffer {
 public:
  LinearMemoryBuffer(std::shared_ptr<generated::Instance> owner, uint8_t* data, size_t size)
      : owner_(std::move(owner)), data_(data), size_(size) {}
  size_t size() const override {
    return size_;
  }
  uint8_t* data() override {
    return data_;
  }

 private:
  std::shared_ptr<generated::Instance> owner_;
  uint8_t* data_;
  size_t size_;
};

} // namespace

double jsToF64(jsi::Runtime& rt, const jsi::Value& value) {
  if (value.isNumber()) return value.getNumber();
  if (value.isBool()) return value.getBool() ? 1 : 0;
  if (value.isUndefined()) return NAN;
  if (value.isNull()) return 0;
  // Strings and objects: let JavaScript's own ToNumber decide (valueOf, parsing, ...).
  return rt.global().getPropertyAsFunction(rt, "Number").call(rt, value).getNumber();
}

uint32_t jsToU32(jsi::Runtime& rt, const jsi::Value& value) {
  if (value.isNumber()) return doubleToU32(value.getNumber());
  if (value.isBool()) return value.getBool() ? 1 : 0;
  if (value.isUndefined() || value.isNull()) return 0;
  return doubleToU32(jsToF64(rt, value));
}

uint64_t jsToU64(jsi::Runtime& rt, const jsi::Value& value) {
  // ToBigInt64: a BigInt wraps modulo 2^64; a boolean is 0n or 1n; anything else is a TypeError.
  if (value.isBigInt()) return value.getBigInt(rt).getUint64(rt);
  if (value.isBool()) return value.getBool() ? 1 : 0;
  throw jsi::JSError(rt, "TypeError: Cannot convert value to a BigInt");
}

jsi::Object Bridge::instantiate(jsi::Runtime& rt, const jsi::Object& imports) {
  std::shared_ptr<Bridge> bridge(new Bridge(rt));

  bridge->imports_.reserve(generated::kImportCount);
  for (size_t index = 0; index < generated::kImportCount; index++) {
    const char* name = generated::kImportNames[index];
    jsi::Value fn = imports.getProperty(rt, name);
    if (!fn.isObject() || !fn.getObject(rt).isFunction(rt)) {
      throw jsi::JSError(
          rt, std::string("react-native-matrix-sdk-crypto-wasm: the glue does not provide the import ") +
                  generated::kImportModule + " " + name + "; it does not match the native module");
    }
    bridge->imports_.push_back(fn.getObject(rt).getFunction(rt));
  }

  // Instantiation copies data segments and can call imports from a start function, so it runs in
  // a trap frame like any other call.
  generated::Instance* raw = nullptr;
  bridge->memoryObject_.emplace(rt);
  {
    detail::TrapScope scope;
    if (MXCW_SETJMP(scope.frame.buffer) == 0) {
      raw = generated::instantiate(*bridge);
    } else {
      bridge->throwTrap(scope.frame.code);
    }
  }
  bridge->instance_ = std::shared_ptr<generated::Instance>(raw, generated::destroy);
  bridge->syncMemory();

  jsi::Object exports(rt);
  exports.setProperty(rt, "memory", jsi::Value(rt, *bridge->memoryObject_));
  for (size_t index = 0; index < generated::kExportCount; index++) {
    const ExportEntry& entry = generated::kExports[index];
    ExportThunk thunk = entry.thunk;
    exports.setProperty(
        rt,
        entry.name,
        jsi::Function::createFromHostFunction(
            rt,
            jsi::PropNameID::forAscii(rt, entry.name),
            entry.paramCount,
            [bridge, thunk](jsi::Runtime& rt, const jsi::Value&, const jsi::Value* args, size_t count) {
              return thunk(*bridge, rt, args, count);
            }));
  }
  return exports;
}

jsi::Value Bridge::callImport(size_t index, const jsi::Value* args, size_t count) {
  // The module may have grown its memory since control last left it, and the import is about to
  // read that memory through `wasm.memory.buffer`.
  syncMemory();
  return imports_[index].call(rt_, args, count);
}

void Bridge::syncMemory() {
  if (!instance_) return;
  wasm_rt_memory_t* memory = generated::memory(instance_.get());
  if (memory->size == memorySize_ && memory->data == memoryData_) return;
  if (memoryData_ != nullptr && memory->data != memoryData_) {
    // Earlier ArrayBuffers would now point at freed memory. Cannot happen with WASM_RT_USE_MMAP.
    std::abort();
  }
  memoryData_ = memory->data;
  memorySize_ = memory->size;
  auto buffer = std::make_shared<LinearMemoryBuffer>(instance_, memoryData_, static_cast<size_t>(memorySize_));
  memoryObject_->setProperty(rt_, "buffer", jsi::ArrayBuffer(rt_, buffer));
}

void Bridge::throwTrap(wasm_rt_trap_t code) {
  // A real WebAssembly instance throws WebAssembly.RuntimeError here; the glue never inspects the
  // type, so a plain Error with the same message is enough.
  throw jsi::JSError(rt_, std::string("RuntimeError: ") + wasm_rt_strerror(code));
}

void install(jsi::Runtime& rt) {
  static std::once_flag initialized;
  std::call_once(initialized, [] { wasm_rt_init(); });

  jsi::Object host(rt);
  host.setProperty(
      rt,
      "instantiate",
      jsi::Function::createFromHostFunction(
          rt,
          jsi::PropNameID::forAscii(rt, "instantiate"),
          1,
          [](jsi::Runtime& rt, const jsi::Value&, const jsi::Value* args, size_t count) -> jsi::Value {
            if (count < 1 || !args[0].isObject()) {
              throw jsi::JSError(rt, "instantiate(imports): pass the wasm-bindgen glue module");
            }
            return Bridge::instantiate(rt, args[0].getObject(rt));
          }));
  rt.global().setProperty(rt, "__matrixSdkCryptoWasm2c", host);
}

} // namespace matrixsdkcryptowasm
