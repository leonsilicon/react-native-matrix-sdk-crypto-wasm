/**
 * A pure C++ TurboModule: autolinking compiles android/CMakeLists.txt into the app and
 * registers MatrixSdkCryptoWasmModule from cpp/MatrixSdkCryptoWasmModule.h.
 *
 * @type {import('@react-native-community/cli-types').UserDependencyConfig}
 */
module.exports = {
  dependency: {
    platforms: {
      android: {
        cxxModuleCMakeListsModuleName: "react-native-matrix-sdk-crypto-wasm",
        cxxModuleCMakeListsPath: "CMakeLists.txt",
        cxxModuleHeaderName: "MatrixSdkCryptoWasmModule",
        packageImportPath: "import com.leonsilicon.matrixsdkcryptowasm.MatrixSdkCryptoWasmPackage;",
        packageInstance: "new MatrixSdkCryptoWasmPackage()",
      },
    },
  },
};
