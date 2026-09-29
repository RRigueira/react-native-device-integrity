package com.deviceintegrity

import com.facebook.react.bridge.ReactApplicationContext

class DeviceIntegrityModule(reactContext: ReactApplicationContext) :
  NativeDeviceIntegritySpec(reactContext) {

  override fun multiply(a: Double, b: Double): Double {
    return a * b
  }

  companion object {
    const val NAME = NativeDeviceIntegritySpec.NAME
  }
}
