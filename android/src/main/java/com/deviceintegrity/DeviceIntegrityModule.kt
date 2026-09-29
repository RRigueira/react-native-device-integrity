package com.deviceintegrity

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import java.util.concurrent.Executors

class DeviceIntegrityModule(reactContext: ReactApplicationContext) :
  NativeDeviceIntegritySpec(reactContext) {

  override fun checkIntegrity(promise: Promise) {
    executor.execute {
      try {
        val report = IntegrityChecks(reactApplicationContext).run()
        promise.resolve(toWritableMap(report))
      } catch (t: Throwable) {
        promise.reject("E_INTEGRITY", t.message ?: "Unexpected integrity check failure", t)
      }
    }
  }

  companion object {
    const val NAME = NativeDeviceIntegritySpec.NAME

    private val executor = Executors.newSingleThreadExecutor { runnable ->
      Thread(runnable, "DeviceIntegrityChecks").apply { isDaemon = true }
    }

    private fun toWritableMap(report: IntegrityChecks.Report): WritableMap {
      val map = Arguments.createMap()
      map.putBoolean("completed", report.completed)
      report.reason?.let { map.putString("reason", it) }

      val signals: WritableArray = Arguments.createArray()
      for (signal in report.signals) {
        val entry = Arguments.createMap()
        entry.putString("id", signal.id)
        entry.putString("category", signal.category)
        entry.putString("description", signal.description)
        signals.pushMap(entry)
      }
      map.putArray("signals", signals)
      return map
    }
  }
}
