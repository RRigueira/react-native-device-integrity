package com.deviceintegrity

import com.facebook.react.bridge.ReactApplicationContext

class DeviceIntegrityModule(reactContext: ReactApplicationContext) :
  NativeDeviceIntegritySpec(reactContext) {

  companion object {
    const val NAME = NativeDeviceIntegritySpec.NAME
  }
}
