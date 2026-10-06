package com.deviceintegrity

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import java.util.concurrent.Executors

class DeviceIntegrityModule(reactContext: ReactApplicationContext) :
  NativeDeviceIntegritySpec(reactContext) {

  override fun checkIntegrity(options: ReadableMap, promise: Promise) {
    executor.execute {
      try {
        val androidOptions = parseAndroidOptions(options)
        val report = IntegrityChecks(reactApplicationContext).run(androidOptions)
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

    /**
     * Defensive parse of `options.android`. Missing keys, nulls, and wrong types
     * are treated as not configured (empty lists).
     */
    internal fun parseAndroidOptions(options: ReadableMap?): AndroidTamperOptions {
      if (options == null || !options.hasKey("android") || options.isNull("android")) {
        return AndroidTamperOptions()
      }
      if (options.getType("android") != ReadableType.Map) {
        return AndroidTamperOptions()
      }

      val android =
        try {
          options.getMap("android")
        } catch (_: Throwable) {
          null
        } ?: return AndroidTamperOptions()

      return AndroidTamperOptions(
        expectedSigningCertificates =
          readStringList(android, "expectedSigningCertificates"),
        allowedInstallers = readStringList(android, "allowedInstallers"),
      )
    }

    private fun readStringList(map: ReadableMap, key: String): List<String> {
      if (!map.hasKey(key) || map.isNull(key)) {
        return emptyList()
      }
      if (map.getType(key) != ReadableType.Array) {
        return emptyList()
      }

      val array: ReadableArray =
        try {
          map.getArray(key)
        } catch (_: Throwable) {
          null
        } ?: return emptyList()

      val result = ArrayList<String>(array.size())
      for (i in 0 until array.size()) {
        if (array.isNull(i)) {
          continue
        }
        if (array.getType(i) != ReadableType.String) {
          continue
        }
        val value =
          try {
            array.getString(i)
          } catch (_: Throwable) {
            null
          }
        if (value != null) {
          result.add(value)
        }
      }
      return result
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

      if (report.reportOnly.isNotEmpty()) {
        val reportOnly: WritableArray = Arguments.createArray()
        report.reportOnly.forEach { reportOnly.pushString(it) }
        map.putArray("reportOnly", reportOnly)
      }
      return map
    }
  }
}
