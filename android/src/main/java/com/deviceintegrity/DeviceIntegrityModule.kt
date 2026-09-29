package com.deviceintegrity

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext

class DeviceIntegrityModule(reactContext: ReactApplicationContext) :
  NativeDeviceIntegritySpec(reactContext) {

  override fun checkIntegrity(promise: Promise) {
    val result = Arguments.createMap()
    result.putBoolean("completed", false)
    result.putString("reason", "not_implemented")
    result.putArray("signals", Arguments.createArray())
    promise.resolve(result)
  }

  companion object {
    const val NAME = NativeDeviceIntegritySpec.NAME
  }
}
