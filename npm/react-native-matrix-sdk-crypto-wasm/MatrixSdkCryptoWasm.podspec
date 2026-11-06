require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

# How the wasm2c runtime is configured. These change struct layouts and code paths, so every
# file in the pod (the module's C, the runtime, the bridge) must be compiled with the same set.
wasm_rt_defines = [
  "WASM_RT_USE_MMAP=1",              # reserve address space up front: memory never moves
  "WASM_RT_MEMCHECK_BOUNDS_CHECK=1", # explicit bounds checks instead of guard pages ...
  "WASM_RT_SKIP_SIGNAL_RECOVERY=1",  # ... so no SIGSEGV handler is installed in the app
  "WASM_RT_STACK_DEPTH_COUNT=1",     # count call depth instead of catching stack overflow
  "WASM_RT_MAX_CALL_STACK_DEPTH=10000",
  "WASM_RT_TRAP_HANDLER=mxcw_trap_handler",
]

Pod::Spec.new do |s|
  s.name         = "MatrixSdkCryptoWasm"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => min_ios_version_supported }
  s.source       = { :git => "https://github.com/leonsilicon/react-native-matrix-sdk-crypto-wasm.git", :tag => "#{s.version}" }

  s.source_files = [
    "ios/**/*.{h,m,mm}",
    "cpp/*.{h,c,cpp}",
    "generated/c/*.{h,c,cpp}",
    "generated/c/wasm-rt/*.h",
    "generated/c/wasm-rt/wasm-rt-impl.c",
    "generated/c/wasm-rt/wasm-rt-mem-impl.c",
  ]
  s.preserve_paths = "generated/c/wasm-rt/*.inc"
  s.private_header_files = "cpp/*.h", "generated/c/**/*.h"

  s.pod_target_xcconfig = {
    "HEADER_SEARCH_PATHS" => [
      "\"$(PODS_TARGET_SRCROOT)/cpp\"",
      "\"$(PODS_TARGET_SRCROOT)/generated/c\"",
      "\"$(PODS_TARGET_SRCROOT)/generated/c/wasm-rt\"",
    ].join(" "),
    "GCC_PREPROCESSOR_DEFINITIONS" => "$(inherited) #{wasm_rt_defines.join(" ")}",
    "CLANG_CXX_LANGUAGE_STANDARD" => "c++20",
    # About 130 MB of generated C: unoptimized, it would make Debug builds' crypto very slow.
    "GCC_OPTIMIZATION_LEVEL" => "2",
    # JavaScript exceptions thrown by imports unwind through the module's C frames.
    "OTHER_CFLAGS" => "$(inherited) -fexceptions",
    "GCC_ENABLE_CPP_EXCEPTIONS" => "YES",
  }

  install_modules_dependencies(s)
end
