// A minimal JavaScript host: Hermes through JSI (the same API React Native's runtime uses), the
// bridge from the npm package, and just enough of a browser-like global environment for the
// wasm-bindgen glue: console, timers, performance.now and a CSPRNG. It evaluates one bundle,
// runs its timers and microtasks to completion, and exits with globalThis.__harnessExitCode.

#include <hermes/hermes.h>
#include <jsi/jsi.h>

#include <chrono>
#include <cstdio>
#include <cstdlib>
#include <fstream>
#include <iostream>
#include <map>
#include <memory>
#include <sstream>
#include <string>
#include <thread>

#if defined(__APPLE__)
#include <stdlib.h> // arc4random_buf
#else
#include <sys/random.h> // getrandom
#endif

#include "Wasm2cBridge.h"

namespace jsi = facebook::jsi;

namespace {

using Clock = std::chrono::steady_clock;
const Clock::time_point kStart = Clock::now();

double nowMs() {
  return std::chrono::duration<double, std::milli>(Clock::now() - kStart).count();
}

void fillRandom(uint8_t* data, size_t length) {
#if defined(__APPLE__)
  arc4random_buf(data, length);
#else
  while (length > 0) {
    ssize_t n = getrandom(data, length, 0);
    if (n <= 0) std::abort();
    data += n;
    length -= static_cast<size_t>(n);
  }
#endif
}

struct Timer {
  double id;
  jsi::Function callback;
};

class Host {
 public:
  explicit Host(jsi::Runtime& rt) : rt_(rt) {}

  void install() {
    auto global = rt_.global();
    define(global, "__harnessPrint", 1, [](jsi::Runtime& rt, const jsi::Value&, const jsi::Value* args, size_t count) {
      std::string line = count > 0 ? args[0].toString(rt).utf8(rt) : "";
      std::fwrite(line.data(), 1, line.size(), stdout);
      std::fputc('\n', stdout);
      std::fflush(stdout);
      return jsi::Value::undefined();
    });
    define(global, "__harnessNow", 0, [](jsi::Runtime&, const jsi::Value&, const jsi::Value*, size_t) {
      return jsi::Value(nowMs());
    });
    // (arrayBuffer, byteOffset, byteLength); JSI has no typed-array API, so JS passes the parts.
    define(global, "__harnessFillRandom", 3, [](jsi::Runtime& rt, const jsi::Value&, const jsi::Value* args, size_t count) {
      if (count < 3) throw jsi::JSError(rt, "__harnessFillRandom(buffer, offset, length)");
      auto buffer = args[0].getObject(rt).getArrayBuffer(rt);
      auto offset = static_cast<size_t>(args[1].getNumber());
      auto length = static_cast<size_t>(args[2].getNumber());
      if (offset + length > buffer.size(rt)) throw jsi::JSError(rt, "__harnessFillRandom: out of range");
      fillRandom(buffer.data(rt) + offset, length);
      return jsi::Value::undefined();
    });
    define(global, "setTimeout", 2, [this](jsi::Runtime& rt, const jsi::Value&, const jsi::Value* args, size_t count) {
      if (count < 1 || !args[0].isObject() || !args[0].getObject(rt).isFunction(rt)) {
        throw jsi::JSError(rt, "setTimeout: callback must be a function");
      }
      double delay = count > 1 && args[1].isNumber() ? args[1].getNumber() : 0;
      double id = ++lastTimerId_;
      timers_.emplace(nowMs() + (delay > 0 ? delay : 0), Timer{id, args[0].getObject(rt).getFunction(rt)});
      return jsi::Value(id);
    });
    define(global, "clearTimeout", 1, [this](jsi::Runtime&, const jsi::Value&, const jsi::Value* args, size_t count) {
      if (count > 0 && args[0].isNumber()) {
        for (auto it = timers_.begin(); it != timers_.end(); ++it) {
          if (it->second.id == args[0].getNumber()) {
            timers_.erase(it);
            break;
          }
        }
      }
      return jsi::Value::undefined();
    });
    if (!global.hasProperty(rt_, "queueMicrotask")) {
      define(global, "queueMicrotask", 1, [](jsi::Runtime& rt, const jsi::Value&, const jsi::Value* args, size_t count) {
        if (count < 1) throw jsi::JSError(rt, "queueMicrotask: callback required");
        rt.queueMicrotask(args[0].getObject(rt).getFunction(rt));
        return jsi::Value::undefined();
      });
    }
  }

  /// Runs microtasks, then due timers, until nothing is left.
  void runEventLoop() {
    rt_.drainMicrotasks();
    while (!timers_.empty()) {
      auto next = timers_.begin();
      double wait = next->first - nowMs();
      if (wait > 0) std::this_thread::sleep_for(std::chrono::duration<double, std::milli>(wait));
      jsi::Function callback = std::move(next->second.callback);
      timers_.erase(next);
      callback.call(rt_);
      rt_.drainMicrotasks();
    }
  }

 private:
  void define(jsi::Object& target, const char* name, unsigned params, jsi::HostFunctionType fn) {
    target.setProperty(
        rt_, name, jsi::Function::createFromHostFunction(rt_, jsi::PropNameID::forAscii(rt_, name), params, std::move(fn)));
  }

  jsi::Runtime& rt_;
  std::multimap<double, Timer> timers_;
  double lastTimerId_ = 0;
};

std::string readFile(const char* path) {
  std::ifstream in(path, std::ios::binary);
  if (!in) {
    std::cerr << "cannot read " << path << "\n";
    std::exit(2);
  }
  std::ostringstream contents;
  contents << in.rdbuf();
  return contents.str();
}

} // namespace

int main(int argc, char** argv) {
  if (argc != 2) {
    std::cerr << "usage: " << argv[0] << " <bundle.js>\n";
    return 2;
  }
  auto runtime = facebook::hermes::makeHermesRuntime(
      ::hermes::vm::RuntimeConfig::Builder().withMicrotaskQueue(true).build());
  jsi::Runtime& rt = *runtime;
  int exitCode = 1;
  try {
    Host host(rt);
    host.install();
    matrixsdkcryptowasm::install(rt);
    rt.evaluateJavaScript(std::make_shared<jsi::StringBuffer>(readFile(argv[1])), argv[1]);
    host.runEventLoop();
    jsi::Value code = rt.global().getProperty(rt, "__harnessExitCode");
    exitCode = code.isNumber() ? static_cast<int>(code.getNumber()) : 1;
    if (!code.isNumber()) std::cerr << "the bundle finished without setting __harnessExitCode\n";
  } catch (const jsi::JSError& error) {
    std::cerr << "uncaught: " << error.getMessage() << "\n" << error.getStack() << "\n";
  } catch (const std::exception& error) {
    std::cerr << "fatal: " << error.what() << "\n";
  }
  return exitCode;
}
