cmake_minimum_required(VERSION 3.20)
project(MatrixSdkCryptoWasmHermesHarness C CXX)

# -DHERMES_SRC_DIR=<hermes checkout> -DHERMES_BUILD_DIR=<its cmake build with target hermesvm>
# -DPACKAGE_DIR=<npm/react-native-matrix-sdk-crypto-wasm>
foreach(var HERMES_SRC_DIR HERMES_BUILD_DIR PACKAGE_DIR)
  if(NOT DEFINED ${var})
    message(FATAL_ERROR "${var} is required")
  endif()
endforeach()

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

set(GENERATED_C ${PACKAGE_DIR}/generated/c)
file(GLOB MODULE_C ${GENERATED_C}/mxcrypto_*.c)

add_executable(
  matrix-sdk-crypto-wasm-hermes-harness
  harness.cpp
  ${PACKAGE_DIR}/cpp/Wasm2cBridge.cpp
  ${PACKAGE_DIR}/cpp/wasm2c-trap.c
  ${GENERATED_C}/jsi-bindings.cpp
  ${GENERATED_C}/wasm-rt/wasm-rt-impl.c
  ${GENERATED_C}/wasm-rt/wasm-rt-mem-impl.c
  ${MODULE_C}
)

# The same runtime configuration as the podspec and android/CMakeLists.txt.
target_compile_definitions(
  matrix-sdk-crypto-wasm-hermes-harness PRIVATE
  WASM_RT_USE_MMAP=1
  WASM_RT_MEMCHECK_BOUNDS_CHECK=1
  WASM_RT_SKIP_SIGNAL_RECOVERY=1
  WASM_RT_STACK_DEPTH_COUNT=1
  WASM_RT_MAX_CALL_STACK_DEPTH=10000
  WASM_RT_TRAP_HANDLER=mxcw_trap_handler
)
set_source_files_properties(${MODULE_C} PROPERTIES COMPILE_OPTIONS "-O2;-fexceptions;-w")
set_source_files_properties(${PACKAGE_DIR}/cpp/wasm2c-trap.c PROPERTIES COMPILE_OPTIONS "-fexceptions")

target_include_directories(
  matrix-sdk-crypto-wasm-hermes-harness PRIVATE
  ${PACKAGE_DIR}/cpp
  ${GENERATED_C}
  ${GENERATED_C}/wasm-rt
  ${HERMES_SRC_DIR}/API
  ${HERMES_SRC_DIR}/API/jsi
  ${HERMES_SRC_DIR}/public
)

find_library(HERMESVM hermesvm PATHS ${HERMES_BUILD_DIR}/lib ${HERMES_BUILD_DIR}/API/hermes NO_DEFAULT_PATH REQUIRED)
find_library(JSI jsi PATHS ${HERMES_BUILD_DIR}/jsi NO_DEFAULT_PATH REQUIRED)
target_link_libraries(matrix-sdk-crypto-wasm-hermes-harness PRIVATE ${HERMESVM} ${JSI})
set_target_properties(matrix-sdk-crypto-wasm-hermes-harness PROPERTIES BUILD_RPATH "${HERMES_BUILD_DIR}/lib")
