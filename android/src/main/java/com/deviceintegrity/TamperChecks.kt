package com.deviceintegrity

import android.content.Context
import android.content.pm.PackageManager
import android.content.pm.Signature
import android.os.Build
import java.security.MessageDigest

/**
 * Android tamper signals (signing certificate + install source).
 *
 * Independent implementation informed by OWASP MASTG
 * (MASTG-TEST-0038-style signature verification / install source checks);
 * no code copied.
 */
internal data class AndroidTamperOptions(
  val expectedSigningCertificates: List<String> = emptyList(),
  val allowedInstallers: List<String> = emptyList(),
)

internal class TamperChecks(
  private val context: Context,
  private val options: AndroidTamperOptions,
) {

  fun checkSignatureMismatch(): IntegrityChecks.Signal? {
    if (options.expectedSigningCertificates.isEmpty()) {
      return null
    }

    val expected =
      options.expectedSigningCertificates
        .map { normalizeCertDigest(it) }
        .filter { it.isNotEmpty() }
        .toSet()
    // Configured but no usable digest (e.g. blank values): the check cannot run.
    // Throwing marks the report incomplete instead of silently passing.
    if (expected.isEmpty()) {
      throw IllegalArgumentException("expectedSigningCertificates contains no usable digest")
    }

    val current = currentSigningDigests()
    if (current.any { digest -> digest in expected }) {
      return null
    }

    return IntegrityChecks.Signal(
      id = "tamper_signature_mismatch",
      category = "tamper",
      description = "App signing certificate does not match the expected certificate",
    )
  }

  fun checkUntrustedInstaller(): IntegrityChecks.Signal? {
    if (options.allowedInstallers.isEmpty()) {
      return null
    }

    val allowed =
      options.allowedInstallers
        .filter { it.isNotEmpty() }
        .toSet()
    // Configured but only blank values: the check cannot run, so report incomplete.
    if (allowed.isEmpty()) {
      throw IllegalArgumentException("allowedInstallers contains no usable package name")
    }

    val installer = installingPackageName()

    if (!installer.isNullOrEmpty() && installer in allowed) {
      return null
    }

    return IntegrityChecks.Signal(
      id = "tamper_untrusted_installer",
      category = "tamper",
      description = "The app was installed from an untrusted source",
    )
  }

  private fun installingPackageName(): String? {
    val pm = context.packageManager
    val packageName = context.packageName
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      pm.getInstallSourceInfo(packageName).installingPackageName
    } else {
      @Suppress("DEPRECATION")
      pm.getInstallerPackageName(packageName)
    }
  }

  private fun currentSigningDigests(): Set<String> {
    val pm = context.packageManager
    val packageName = context.packageName

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      val packageInfo =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
          pm.getPackageInfo(
            packageName,
            PackageManager.PackageInfoFlags.of(
              PackageManager.GET_SIGNING_CERTIFICATES.toLong(),
            ),
          )
        } else {
          @Suppress("DEPRECATION")
          pm.getPackageInfo(packageName, PackageManager.GET_SIGNING_CERTIFICATES)
        }

      val signingInfo =
        packageInfo.signingInfo
          ?: throw IllegalStateException("signingInfo unavailable")

      val signatures: Array<Signature> =
        if (signingInfo.hasMultipleSigners()) {
          signingInfo.apkContentsSigners
            ?: throw IllegalStateException("apkContentsSigners unavailable")
        } else {
          val history =
            signingInfo.signingCertificateHistory
              ?: throw IllegalStateException("signingCertificateHistory unavailable")
          if (history.isEmpty()) {
            throw IllegalStateException("signingCertificateHistory empty")
          }
          // Last entry is the current signing key (supports key rotation).
          arrayOf(history.last())
        }

      return signatures.map { sha256Hex(it.toByteArray()) }.toSet()
    }

    @Suppress("DEPRECATION")
    val packageInfo = pm.getPackageInfo(packageName, PackageManager.GET_SIGNATURES)
    @Suppress("DEPRECATION")
    val signatures =
      packageInfo.signatures
        ?: throw IllegalStateException("signatures unavailable")
    if (signatures.isEmpty()) {
      throw IllegalStateException("signatures empty")
    }

    return signatures.map { sha256Hex(it.toByteArray()) }.toSet()
  }

  companion object {
    internal fun normalizeCertDigest(value: String): String =
      value.replace(":", "").replace(Regex("\\s+"), "").lowercase()

    private fun sha256Hex(bytes: ByteArray): String {
      val digest = MessageDigest.getInstance("SHA-256").digest(bytes)
      return buildString(digest.size * 2) {
        for (b in digest) {
          append("%02x".format(b))
        }
      }
    }
  }
}
