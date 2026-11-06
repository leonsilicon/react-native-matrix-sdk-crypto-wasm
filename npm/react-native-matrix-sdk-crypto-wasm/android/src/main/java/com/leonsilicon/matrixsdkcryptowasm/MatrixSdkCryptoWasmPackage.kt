package com.leonsilicon.matrixsdkcryptowasm

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfoProvider

/**
 * The module itself is C++ (registered by autolinking from react-native.config.js); this empty
 * package only gives autolinking a Java entry point for the library.
 */
class MatrixSdkCryptoWasmPackage : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? = null

  override fun getReactModuleInfoProvider() = ReactModuleInfoProvider { emptyMap() }
}
