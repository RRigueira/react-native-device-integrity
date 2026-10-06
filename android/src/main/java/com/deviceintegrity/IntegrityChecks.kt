package com.deviceintegrity

import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.Debug
import java.io.BufferedReader
import java.io.File
import java.io.FileReader
import java.util.concurrent.FutureTask
import java.util.concurrent.TimeUnit

/**
 * Check set informed by RootBeer and the OWASP MASTG; independent implementation.
 */
internal class IntegrityChecks(private val context: Context) {

  data class Signal(
    val id: String,
    val category: String,
    val description: String,
  )

  data class Report(
    val completed: Boolean,
    val reason: String? = null,
    val signals: List<Signal>,
    /** Signal ids the app configured as reported-only (never compromising on their own). */
    val reportOnly: List<String> = emptyList(),
  )

  fun run(androidOptions: AndroidTamperOptions = AndroidTamperOptions()): Report {
    val signals = mutableListOf<Signal>()
    val seen = mutableSetOf<String>()
    var completed = true

    fun add(signal: Signal) {
      if (seen.add(signal.id)) {
        signals.add(signal)
      }
    }

    fun runCheck(block: () -> Signal?) {
      try {
        block()?.let { add(it) }
      } catch (_: Throwable) {
        completed = false
      }
    }

    runCheck { checkEmulator() }
    // Emulators boot with an unlocked (orange) state too; they're already
    // reported as `emulator`, which isn't compromising by default.
    val bootloaderMode = BootloaderUnlockedMode.read(context)
    if (bootloaderMode != BootloaderUnlockedMode.OFF) {
      runCheck { if ("emulator" in seen) null else checkBootloaderUnlocked() }
    }
    runCheck { checkRootSuBinary() }
    runCheck { checkRootManagementApps() }
    runCheck { checkRootMagiskFiles() }
    runCheck { checkRootTestKeys() }
    runCheck { checkRootDangerousProps() }
    runCheck { checkRootRwSystem() }
    runCheck { checkHookingFrida() }
    runCheck { checkHookingXposed() }
    runCheck { checkDebuggerAttached() }

    val tamper = TamperChecks(context, androidOptions)
    runCheck { tamper.checkSignatureMismatch() }
    runCheck { tamper.checkUntrustedInstaller() }

    return Report(
      completed = completed,
      reason = if (completed) null else "incomplete",
      signals = signals,
      reportOnly =
        if (bootloaderMode == BootloaderUnlockedMode.REPORT) listOf("bootloader_unlocked") else emptyList(),
    )
  }

  // --- emulator ---

  private fun checkEmulator(): Signal? {
    val fingerprint = Build.FINGERPRINT.orEmpty().lowercase()
    val model = Build.MODEL.orEmpty()
    val manufacturer = Build.MANUFACTURER.orEmpty()
    val hardware = Build.HARDWARE.orEmpty().lowercase()
    val product = Build.PRODUCT.orEmpty().lowercase()
    val brand = Build.BRAND.orEmpty().lowercase()
    val device = Build.DEVICE.orEmpty().lowercase()

    val fingerprintGeneric =
      fingerprint.startsWith("generic") ||
        fingerprint.startsWith("unknown") ||
        fingerprint.contains("emulator") ||
        fingerprint.contains("sdk_gphone")

    val hardwareEmulator = hardware in setOf("goldfish", "ranchu", "vbox86")

    val qemuFiles =
      File("/dev/qemu_pipe").exists() || File("/dev/socket/qemud").exists()

    val modelHit =
      model.contains("google_sdk", ignoreCase = true) ||
        model.contains("Emulator", ignoreCase = true) ||
        model.contains("Android SDK built for", ignoreCase = true) ||
        model.contains("sdk_gphone", ignoreCase = true)

    val manufacturerHit = manufacturer.contains("Genymotion", ignoreCase = true)

    val productHit =
      product.contains("sdk") ||
        product.contains("sdk_gphone") ||
        product.contains("vbox86p") ||
        product.contains("emulator") ||
        product.contains("simulator")

    val brandDeviceGeneric = brand.startsWith("generic") && device.startsWith("generic")

    val anyIndicator =
      fingerprintGeneric ||
        hardwareEmulator ||
        qemuFiles ||
        modelHit ||
        manufacturerHit ||
        productHit ||
        brandDeviceGeneric

    if (!anyIndicator) {
      return null
    }

    // Require at least one strong indicator to avoid false positives.
    val strongIndicators = fingerprintGeneric || hardwareEmulator || qemuFiles
    if (!strongIndicators) {
      return null
    }

    return Signal(
      id = "emulator",
      category = "emulator",
      description = "Device appears to be an emulator",
    )
  }

  // --- bootloader ---

  /**
   * Verified boot state as set by the bootloader: `green` (locked, stock keys),
   * `yellow` (locked, user-installed keys), `orange` (unlocked). Readable by any
   * app; a root framework can still spoof the properties for hidden apps.
   */
  private fun checkBootloaderUnlocked(): Signal? {
    val verifiedBootState = readSystemProperty("ro.boot.verifiedbootstate")
    val flashLocked = readSystemProperty("ro.boot.flash.locked")
    val deviceState = readSystemProperty("ro.boot.vbmeta.device_state")

    if (verifiedBootState == null && flashLocked == null && deviceState == null) {
      throw IllegalStateException("getprop failed")
    }

    val unlocked =
      verifiedBootState == "orange" || flashLocked == "0" || deviceState == "unlocked"
    if (!unlocked) {
      return null
    }

    return Signal(
      id = "bootloader_unlocked",
      category = "environment",
      description = "The device bootloader is unlocked",
    )
  }

  // --- root ---

  private fun checkRootSuBinary(): Signal? {
    val knownDirs =
      listOf(
        "/system/bin",
        "/system/xbin",
        "/sbin",
        "/system/sd/xbin",
        "/system/bin/failsafe",
        "/data/local/xbin",
        "/data/local/bin",
        "/data/local",
        "/su/bin",
      )

    val pathDirs =
      System.getenv("PATH")
        ?.split(':')
        ?.map { it.trim() }
        ?.filter { it.isNotEmpty() }
        .orEmpty()

    val dirs = (knownDirs + pathDirs).distinct()

    val foundSu =
      dirs.any { dir -> File(dir, "su").exists() } ||
        File("/system/app/Superuser.apk").exists()

    if (!foundSu) {
      return null
    }

    return Signal(
      id = "root_su_binary",
      category = "root",
      description = "A privileged elevation binary was found",
    )
  }

  private fun checkRootManagementApps(): Signal? {
    val packages =
      listOf(
        "com.topjohnwu.magisk",
        "io.github.huskydg.magisk",
        "eu.chainfire.supersu",
        "com.koushikdutta.superuser",
        "com.noshufou.android.su",
        "com.thirdparty.superuser",
        "com.yellowes.su",
        "com.kingroot.kinguser",
        "com.kingo.root",
        "com.zhiqupk.root.global",
        "com.smedialink.oneclickroot",
        "me.weishu.kernelsu",
        "me.bmax.apatch",
        "com.devadvance.rootcloak",
        "de.robv.android.xposed.installer",
        "org.lsposed.manager",
      )

    val pm = context.packageManager
    val found =
      packages.any { packageName ->
        try {
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            pm.getPackageInfo(packageName, PackageManager.PackageInfoFlags.of(0))
          } else {
            @Suppress("DEPRECATION")
            pm.getPackageInfo(packageName, 0)
          }
          true
        } catch (_: PackageManager.NameNotFoundException) {
          false
        }
      }

    if (!found) {
      return null
    }

    return Signal(
      id = "root_management_apps",
      category = "root",
      description = "A root or privilege-management app is installed",
    )
  }

  private fun checkRootMagiskFiles(): Signal? {
    // Legacy locations (older Magisk / su-based roots). Current Magisk, KernelSU
    // and APatch keep their files under /data/adb and a tmpfs that a normal app
    // can't list, so on their own these miss a modern install.
    val paths =
      listOf(
        "/sbin/.magisk",
        "/sbin/.core",
        "/cache/.disable_magisk",
        "/dev/.magisk.unblock",
        "/data/adb/magisk",
        "/data/adb/ksu",
        "/data/adb/ap",
        "/init.magisk.rc",
      )

    if (!paths.any { File(it).exists() } && !hasRootFrameworkMounts()) {
      return null
    }

    return Signal(
      id = "root_magisk_files",
      category = "root",
      description = "Root framework artifacts were detected",
    )
  }

  /**
   * The mounts a root framework creates (e.g. Magisk's `magisk` tmpfs over
   * /debug_ramdisk and the bin directories) are listed in the app's own mount
   * table, which it can always read — unless the framework unmounts them for
   * this app (Magisk DenyList, KernelSU umount).
   */
  private fun hasRootFrameworkMounts(): Boolean {
    val sources = setOf("magisk", "ksu", "apatch")
    return File("/proc/self/mountinfo").useLines { lines ->
      lines.any { line ->
        // "<id> <parent> <dev> <root> <mount point> <options> [optional…] - <fstype> <source> <super options>"
        val separator = line.indexOf(" - ")
        if (separator < 0) {
          return@any false
        }
        val mountPoint = line.substring(0, separator).split(' ').getOrNull(4).orEmpty()
        val source = line.substring(separator + 3).split(' ').getOrNull(1).orEmpty()
        source.lowercase() in sources || mountPoint.contains("/.magisk")
      }
    }
  }

  private fun checkRootTestKeys(): Signal? {
    val tags = Build.TAGS ?: return null
    if (!tags.contains("test-keys")) {
      return null
    }

    return Signal(
      id = "root_test_keys",
      category = "root",
      description = "Build was signed with test keys",
    )
  }

  private fun checkRootDangerousProps(): Signal? {
    val debuggable = readSystemProperty("ro.debuggable") ?: throw IllegalStateException("getprop failed")
    val secure = readSystemProperty("ro.secure") ?: throw IllegalStateException("getprop failed")

    if (debuggable != "1" && secure != "0") {
      return null
    }

    return Signal(
      id = "root_dangerous_props",
      category = "root",
      description = "System security properties indicate an insecure build",
    )
  }

  /**
   * All system properties from one `getprop` dump, read once per run. Spawning
   * a process costs ~100 ms from an app, so per-property calls add up quickly.
   * Null when the dump can't be read; a property missing from it is "".
   */
  private val systemProperties: Map<String, String>? by lazy { readAllSystemProperties() }

  private fun readSystemProperty(name: String): String? =
    systemProperties?.let { it[name].orEmpty() }

  private fun readAllSystemProperties(): Map<String, String>? {
    var process: Process? = null
    return try {
      val started = ProcessBuilder("getprop").redirectErrorStream(true).start()
      process = started
      // Drain stdout while waiting: the full dump can exceed the pipe buffer,
      // and getprop would block on write until it's read.
      val output = FutureTask { started.inputStream.bufferedReader().use { it.readText() } }
      Thread(output, "DeviceIntegrity-getprop").apply { isDaemon = true }.start()
      val text = output.get(1, TimeUnit.SECONDS)

      // Lines look like "[ro.secure]: [1]".
      buildMap {
        text.lineSequence().forEach { line ->
          val separator = line.indexOf("]: [")
          if (line.startsWith("[") && line.endsWith("]") && separator > 0) {
            put(line.substring(1, separator), line.substring(separator + 4, line.length - 1))
          }
        }
      }.takeIf { it.isNotEmpty() } // an empty dump means we couldn't read it
    } catch (_: Throwable) {
      null
    } finally {
      try {
        process?.destroyForcibly()
      } catch (_: Throwable) {
        // ignore
      }
    }
  }

  private fun checkRootRwSystem(): Signal? {
    val targets =
      setOf("/system", "/system/bin", "/system/xbin", "/vendor", "/sbin", "/etc")

    BufferedReader(FileReader("/proc/mounts")).use { reader ->
      var line: String?
      while (reader.readLine().also { line = it } != null) {
        val parts = line!!.split(Regex("\\s+"))
        if (parts.size < 4) {
          continue
        }
        val mountPoint = parts[1]
        val options = parts[3].split(',')
        if (mountPoint in targets && "rw" in options) {
          return Signal(
            id = "root_rw_system",
            category = "root",
            description = "A system partition is mounted read-write",
          )
        }
      }
    }

    return null
  }

  // --- hooking ---

  private fun checkHookingFrida(): Signal? {
    val mapMarkers =
      listOf("frida-agent", "frida-gadget", "libfrida", "gum-js-loop", "linjector")

    if (mapsContainAny(mapMarkers)) {
      return Signal(
        id = "hooking_frida",
        category = "hooking",
        description = "Instrumentation framework artifacts were detected",
      )
    }

    // Only gum-js-loop is treated as a strong task-name indicator.
    if (taskCommContains("gum-js-loop")) {
      return Signal(
        id = "hooking_frida",
        category = "hooking",
        description = "Instrumentation framework artifacts were detected",
      )
    }

    return null
  }

  private fun checkHookingXposed(): Signal? {
    val mapMarkers =
      listOf(
        "XposedBridge.jar",
        "liblspd",
        "libriru",
        "libsubstrate",
        "libzygisk",
      )

    if (mapsContainAny(mapMarkers)) {
      return xposedSignal()
    }

    if (classPresent("de.robv.android.xposed.XposedBridge")) {
      return xposedSignal()
    }

    val stack = Thread.currentThread().stackTrace
    val hooked =
      stack.any { frame ->
        val name = frame.className
        name.startsWith("de.robv.android.xposed") ||
          name.startsWith("com.saurik.substrate")
      }

    if (hooked) {
      return xposedSignal()
    }

    return null
  }

  private fun xposedSignal(): Signal =
    Signal(
      id = "hooking_xposed",
      category = "hooking",
      description = "Code-injection framework artifacts were detected",
    )

  private fun classPresent(name: String): Boolean {
    val loaders =
      listOfNotNull(
        context.classLoader,
        ClassLoader.getSystemClassLoader(),
      ).distinct()

    for (loader in loaders) {
      try {
        Class.forName(name, false, loader)
        return true
      } catch (_: ClassNotFoundException) {
        // continue
      }
    }
    return false
  }

  // --- debugger ---

  private fun checkDebuggerAttached(): Signal? {
    if (!Debug.isDebuggerConnected() && !Debug.waitingForDebugger()) {
      return null
    }

    return Signal(
      id = "debugger_attached",
      category = "debugger",
      description = "A debugger is attached to the process",
    )
  }

  // --- helpers ---

  private fun mapsContainAny(markers: List<String>): Boolean {
    BufferedReader(FileReader("/proc/self/maps")).use { reader ->
      var line: String?
      while (reader.readLine().also { line = it } != null) {
        val current = line!!
        if (markers.any { marker -> current.contains(marker) }) {
          return true
        }
      }
    }
    return false
  }

  private fun taskCommContains(name: String): Boolean {
    val taskDir = File("/proc/self/task")
    val tasks = taskDir.listFiles() ?: return false
    for (task in tasks) {
      val comm = File(task, "comm")
      if (!comm.exists()) {
        continue
      }
      try {
        val text = comm.readText().trim()
        if (text == name) {
          return true
        }
      } catch (_: Throwable) {
        // skip unreadable task entries
      }
    }
    return false
  }
}
