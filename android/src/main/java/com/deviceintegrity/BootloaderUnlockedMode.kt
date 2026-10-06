package com.deviceintegrity

import android.content.Context
import android.content.pm.PackageManager
import android.os.Build

/**
 * App-level defaults set at build time through `<meta-data>` on the app's
 * `<application>` — written by the Expo config plugin, or by hand in bare apps:
 *
 *   <meta-data
 *     android:name="com.deviceintegrity.bootloader_unlocked"
 *     android:value="report" />
 */
internal enum class BootloaderUnlockedMode {
  /** Reported and compromising (default). */
  COMPROMISED,

  /** Reported, but never changes status on its own. */
  REPORT,

  /** The check doesn't run. */
  OFF;

  companion object {
    const val META_DATA_KEY = "com.deviceintegrity.bootloader_unlocked"

    /** Missing, unreadable or unrecognised values fail closed to COMPROMISED. */
    fun read(context: Context): BootloaderUnlockedMode {
      val value =
        try {
          applicationMetaData(context)?.get(META_DATA_KEY)?.toString()?.trim()?.lowercase()
        } catch (_: Throwable) {
          null
        }
      return when (value) {
        "report" -> REPORT
        "off" -> OFF
        else -> COMPROMISED
      }
    }

    @Suppress("DEPRECATION")
    private fun applicationMetaData(context: Context) =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        context.packageManager
          .getApplicationInfo(
            context.packageName,
            PackageManager.ApplicationInfoFlags.of(PackageManager.GET_META_DATA.toLong()),
          )
          .metaData
      } else {
        context.packageManager
          .getApplicationInfo(context.packageName, PackageManager.GET_META_DATA)
          .metaData
      }
  }
}
