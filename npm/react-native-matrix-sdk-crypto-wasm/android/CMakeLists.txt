cmake_minimum_required(VERSION 3.13)
project(MatrixSdkCryptoWasm C CXX)

set(GENERATED_C ${CMAKE_CURRENT_SOURCE_DIR}/../generated/c)
file(GLOB MODULE_C ${GENERATED_C}/mxcrypto_*.c)

add_library(
  react-native-matrix-sdk-crypto-wasm STATIC
  ../cpp/MatrixSdkCryptoWasmModule.cpp
  ../cpp/Wasm2cBridge.cpp
  ../cpp/wasm2c-trap.c
  ${GENERATED_C}/jsi-bindings.cpp
  ${GENERATED_C}/wasm-rt/wasm-rt-impl.c
  ${GENERATED_C}/wasm-rt/wasm-rt-mem-impl.c
  ${MODULE_C}
)

# Keep in sync with MatrixSdkCryptoWasm.podspec (see the comments there).
target_compile_definitions(
  react-native-matrix-sdk-crypto-wasm PUBLIC
  WASM_RT_USE_MMAP=1
  WASM_RT_MEMCHECK_BOUNDS_CHECK=1
  WASM_RT_SKIP_SIGNAL_RECOVERY=1
  WASM_RT_STACK_DEPTH_COUNT=1
  WASM_RT_MAX_CALL_STACK_DEPTH=10000
  WASM_RT_TRAP_HANDLER=mxcw_trap_handler
)

# Optimize the generated C even in debug builds, and let C++ exceptions from JavaScript imports
# unwind through it.
set_source_files_properties(${MODULE_C} PROPERTIES COMPILE_OPTIONS "-O2;-fexceptions;-w")
set_source_files_properties(../cpp/wasm2c-trap.c PROPERTIES COMPILE_OPTIONS "-fexceptions")

set_target_properties(
  react-native-matrix-sdk-crypto-wasm PROPERTIES
  CXX_STANDARD 20
  CXX_STANDARD_REQUIRED ON
  CXX_EXTENSIONS OFF
)

target_include_directories(
  react-native-matrix-sdk-crypto-wasm PUBLIC
  ../cpp
  ${GENERATED_C}
  ${GENERATED_C}/wasm-rt
)

target_link_libraries(
  react-native-matrix-sdk-crypto-wasm
  jsi
  reactnative
  react_codegen_MatrixSdkCryptoWasmSpec
)
