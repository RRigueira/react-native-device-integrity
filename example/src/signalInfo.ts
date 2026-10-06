// Example-only explanations for each signal. The library returns just
// id / category / description; this adds plain-language context for the demo.
// Generated from the site's checks catalogue (react-native-device-integrity-site
// src/content/checks.ts) — keep in sync when a native check changes.
import type { SignalId } from 'react-native-device-integrity';

/** strong: hard evidence · medium: suggestive · context: normal in some setups */
export type SignalStrength = 'strong' | 'medium' | 'context';

export interface SignalPlatformInfo {
  title: string;
  summary: string;
  /** What the native code inspects. */
  checks: string;
  /** What it means if it fires. */
  threat: string;
  /** How a motivated attacker evades it. */
  bypass: string;
  /** OWASP MASTG test ids. */
  mastg: string[];
}

export interface SignalInfo {
  strength: SignalStrength;
  /** When the signal is expected in normal development, if ever. */
  expected?: string;
  platforms: Partial<Record<'ios' | 'android', SignalPlatformInfo>>;
}

export const SIGNAL_INFO: Partial<Record<SignalId, SignalInfo>> = {
  jailbreak_files: {
    strength: 'strong',
    platforms: {
      ios: {
        title: 'Jailbreak file artifacts',
        summary:
          'Looks for ~50 filesystem paths left by jailbreaks, package managers, and tweak loaders.',
        checks:
          'Probes a fixed list of ~50 paths with NSFileManager fileExistsAtPath: and, as a fallback, the POSIX access(path, F_OK) syscall. Two lookups are used because some jailbreaks make paths invisible to the high-level Foundation API but not to the raw syscall.',
        threat:
          "A jailbreak removes Apple's sandbox and code-signing enforcement, giving the user (or malware) root and the ability to read another app's keychain, patch its binary in memory, and dump decrypted App Store binaries.",
        bypass:
          'Rootless jailbreaks (Dopamine, palera1n rootless) relocate the entire jailbreak into /var/jb, so hardcoded legacy paths like /Applications/Cydia.app no longer exist — detection has to know the new roots.',
        mastg: ['MASTG-TEST-0088'],
      },
    },
  },
  jailbreak_symlinks: {
    strength: 'strong',
    platforms: {
      ios: {
        title: 'Jailbreak symlinks',
        summary:
          'Detects system directories that have been replaced with symbolic links to free space on the root partition.',
        checks:
          'Calls NSFileManager destinationOfSymbolicLinkAtPath: on directories that are plain directories on a stock device: /Applications, /Library/Ringtones, /Library/Wallpaper, /usr/include, /usr/libexec, /usr/share and others.',
        threat:
          'Legacy jailbreaks remount the read-only system partition and, because it is small, move large directories to /var and symlink them back. The symlink is a durable structural fingerprint of that remounting even after obvious apps are removed.',
        bypass:
          'Modern rootless jailbreaks never repartition or symlink system directories — they stay inside /var/jb — so this check does not fire on them at all.',
        mastg: ['MASTG-TEST-0088'],
      },
    },
  },
  jailbreak_writable_system: {
    strength: 'strong',
    platforms: {
      ios: {
        title: 'Writable system partition',
        summary:
          'Tries to create a file outside the sandbox, under /private — impossible on a stock device.',
        checks:
          'Builds a random path under /private (e.g. /private/di_integrity_<uuid>), opens it for writing with fopen, writes one byte, closes, and unlink()s it.',
        threat:
          'Writing outside the app container means the sandbox — the boundary that stops one app from tampering with the OS or other apps — is gone. That is the defining capability a jailbreak grants.',
        bypass:
          'On modern iOS the system volume is a signed, cryptographically sealed APFS snapshot (SSV); even many jailbreaks cannot make it writable, so the check can miss rootless jailbreaks that never gain system write.',
        mastg: ['MASTG-TEST-0088'],
      },
    },
  },
  jailbreak_url_schemes: {
    strength: 'medium',
    platforms: {
      ios: {
        title: 'Jailbreak URL schemes',
        summary:
          'Asks the OS whether jailbreak apps (cydia://, sileo://, filza://, …) are installed to handle their URL schemes.',
        checks:
          'Calls UIApplication canOpenURL: for cydia://, sileo://, zbra://, filza://, undecimus:// and activator://. A YES means an app registered to handle that scheme is installed.',
        threat:
          'Package managers and jailbreak utilities register custom URL schemes so tweaks can deep-link into them. Their registration is a strong signal the device hosts jailbreak tooling even if the app binaries sit at non-standard paths.',
        bypass:
          'Apple limits LSApplicationQueriesSchemes to a fixed, declared list; a jailbreak app using an undeclared scheme is invisible to this probe.',
        mastg: ['MASTG-TEST-0088'],
      },
    },
  },
  hooking_libraries: {
    strength: 'strong',
    platforms: {
      ios: {
        title: 'Suspicious loaded libraries',
        summary:
          'Scans every loaded Mach-O image name for instrumentation and tweak-injection frameworks.',
        checks:
          'Walks the loaded image list with _dyld_image_count() / _dyld_get_image_name() and lowercases each path.',
        threat:
          "Dynamic instrumentation (Frida) and tweak loaders (Cydia Substrate, ellekit, libhooker) inject a dylib into the process so they can rewrite functions at runtime — bypassing login, disabling pinning (SSL Kill Switch), or exfiltrating data. If such a library is mapped in, the app's own code can no longer be trusted.",
        bypass:
          "Frida's 'gadget' can be renamed, and stealthier injection maps code anonymously so it never appears as a named image in the dyld list.",
        mastg: ['MASTG-TEST-0091'],
      },
    },
  },
  hooking_dyld_insert: {
    strength: 'medium',
    expected:
      'Expected when Xcode launches the app under its debugger: it injects its view-debugging library through DYLD_INSERT_LIBRARIES.',
    platforms: {
      ios: {
        title: 'DYLD_INSERT_LIBRARIES set',
        summary:
          'Detects the environment variable used to force a dylib into the process at launch.',
        checks:
          'Reads getenv("DYLD_INSERT_LIBRARIES"). A non-empty value means the dynamic linker was asked to load an extra library into the process before main() — the standard way tweak loaders and Frida Gadget inject.',
        threat:
          'DYLD_INSERT_LIBRARIES (the macOS/iOS analogue of LD_PRELOAD) is the simplest injection primitive: point it at a malicious dylib and that code runs inside your app with full access to its memory and keychain.',
        bypass:
          "Apple's Hardened Runtime and the App Store's restricted entitlements strip DYLD_INSERT_LIBRARIES for store apps — but a jailbreak can inject through the kernel/substrate without ever setting the variable, so this check only catches the naive vector.",
        mastg: ['MASTG-TEST-0091'],
      },
    },
  },
  debugger_attached: {
    strength: 'context',
    expected:
      'Expected while the app runs from Xcode or Android Studio with the debugger attached.',
    platforms: {
      ios: {
        title: 'Debugger attached (iOS)',
        summary:
          'Checks the P_TRACED process flag via sysctl — the Apple-documented debugger check.',
        checks:
          'Calls sysctl with {CTL_KERN, KERN_PROC, KERN_PROC_PID, getpid()} to read the kinfo_proc for the current process, then tests the P_TRACED flag in kp_proc.p_flag.',
        threat:
          'A debugger lets an attacker pause the app, read and modify memory and registers, and single-step through security logic — the foundation of most runtime reverse engineering and of patching out checks like this one.',
        bypass:
          'Frida and similar tools attach without setting P_TRACED, so this flag does not catch them.',
        mastg: ['MASTG-TEST-0089'],
      },
      android: {
        title: 'Debugger attached (Android)',
        summary:
          'Uses the Android Debug API to detect a connected or awaited JDWP debugger.',
        checks:
          'Calls android.os.Debug.isDebuggerConnected() and Debug.waitingForDebugger(). Either being true means a JDWP debugger (e.g. Android Studio) is attached to, or is being awaited by, the process.',
        threat:
          'A debugger lets an attacker inspect and alter the running app — stepping through logic, reading variables, and modifying control flow — which is the basis for reverse engineering and for defeating other checks.',
        bypass:
          'This API only reports the Java/JDWP debugger; a native debugger (ptrace via gdb/lldb) or Frida attaches without setting it, so those are not caught here.',
        mastg: ['MASTG-TEST-0046'],
      },
    },
  },
  tamper_team_id_mismatch: {
    strength: 'strong',
    expected:
      'Expected when a build is signed by a team that is not in expectedTeamIds (for example a Personal Team).',
    platforms: {
      ios: {
        title: 'Team ID mismatch',
        summary:
          "Reads the app's signing Team ID via a keychain access group and compares it to your expected value. Opt-in.",
        checks:
          'Adds (if needed) a throwaway kSecClassGenericPassword keychain item, then reads back its kSecAttrAccessGroup. The access group is of the form "TEAMID.<bundle-id>", so the prefix before the first dot is the Apple Team ID. The temporary item is deleted afterward.',
        threat:
          "To patch and redistribute your app, an attacker must re-sign it with their own Apple developer certificate, which changes the Team ID. Pinning the expected Team ID catches resigned / cloned builds distributed via sideloading, enterprise certs, or fake 'modded' versions.",
        bypass:
          'An attacker who knows your real Team ID still cannot sign as you without your private key — but on a jailbroken device they can hook the keychain query or the comparison and fake a match.',
        mastg: ['MASTG-TEST-0081'],
      },
    },
  },
  tamper_binary_decrypted: {
    strength: 'strong',
    expected:
      'Expected for development and ad-hoc builds — only App Store builds are encrypted.',
    platforms: {
      ios: {
        title: 'Decrypted / unencrypted main binary',
        summary:
          'Inspects the Mach-O encryption load command to tell whether the executable is still FairPlay-encrypted. Opt-in.',
        checks:
          "Finds the main executable's Mach-O header, walks its load commands, and reads LC_ENCRYPTION_INFO / LC_ENCRYPTION_INFO_64. A cryptid of 0 — or the absence of the command entirely — means the binary is not encrypted.",
        threat:
          "Reverse engineers 'decrypt' an App Store binary by dumping it from memory after FairPlay decrypts it (e.g. frida-ios-dump), then re-sign and redistribute a cracked, patched, or trojanized copy. An unencrypted main binary at runtime is strong evidence of exactly that pipeline.",
        bypass:
          'An attacker can patch the cryptid byte back to a non-zero value after dumping, so the check sees a value that claims encryption even though the payload is plaintext.',
        mastg: ['MASTG-TEST-0090', 'MASTG-TEST-0091'],
      },
    },
  },
  simulator: {
    strength: 'context',
    expected:
      'Expected on the iOS Simulator. Does not make the status compromised unless treatEmulatorAsCompromised is on.',
    platforms: {
      ios: {
        title: 'iOS Simulator',
        summary:
          'Compile-time flag marking a Simulator build. Reported separately; not compromising by default.',
        checks:
          'Emitted when the module is compiled with TARGET_OS_SIMULATOR — i.e. the app is running on the iOS Simulator rather than a physical device. This is a compile-time fact, not a runtime probe, so it cannot be faked at runtime.',
        threat:
          'The Simulator is a development environment with no real security boundary and full host access. It is a legitimate place to run in development but should usually not be trusted for production / high-value flows.',
        bypass:
          "Not an adversarial check — it reports a fact. By default it does not make status 'compromised'; set treatEmulatorAsCompromised (or a policy including 'emulator') to block Simulator runs.",
        mastg: ['MASTG-TEST-0092'],
      },
    },
  },
  root_su_binary: {
    strength: 'strong',
    platforms: {
      android: {
        title: 'su binary present',
        summary:
          'Searches the PATH and known directories for the su binary and the legacy Superuser.apk.',
        checks:
          'Builds a directory set from a fixed list (/system/bin, /system/xbin, /sbin, /su/bin, /data/local/*, …) plus every entry in the PATH environment variable, then checks for a file named su in each. Also checks /system/app/Superuser.apk.',
        threat:
          "Root removes the Android app sandbox: any process can read another app's private data and keychain-equivalent storage, attach a debugger, or inject code. The su binary is what root-management apps invoke to elevate a process.",
        bypass:
          "Magisk's systemless root historically installed su outside these paths and its DenyList / Zygisk hide the binary from targeted apps, so a File.exists check against the app's view returns false.",
        mastg: ['MASTG-TEST-0045'],
      },
    },
  },
  root_management_apps: {
    strength: 'medium',
    platforms: {
      android: {
        title: 'Root management apps installed',
        summary:
          'Queries PackageManager for ~16 known root, su-manager, and hiding apps.',
        checks:
          'Calls PackageManager.getPackageInfo for a list of package names: Magisk (and forks), SuperSU, Superuser variants, KingRoot/KingoRoot, KernelSU, APatch, RootCloak, and the Xposed/LSPosed managers.',
        threat:
          'A root-manager app is what grants and brokers root to other apps; its presence means the device is rooted and that root can be handed to malware or to tools that attack your app.',
        bypass:
          "Magisk can be installed under a randomized package name specifically to defeat package-name checks; its 'Hide Magisk app' feature does exactly this.",
        mastg: ['MASTG-TEST-0045'],
      },
    },
  },
  root_magisk_files: {
    strength: 'strong',
    platforms: {
      android: {
        title: 'Root framework artifacts',
        summary:
          "Looks for the traces Magisk, KernelSU and APatch leave behind — on disk and in the app's own mount table.",
        checks:
          "Reads /proc/self/mountinfo (always readable by the app) for mounts whose source is magisk, KSU or APatch, or whose path contains /.magisk — current Magisk mounts a 'magisk' tmpfs over /debug_ramdisk and the bin directories. Also tests legacy paths such as /sbin/.magisk, /data/adb/magisk, /data/adb/ksu, /data/adb/ap and /init.magisk.rc.",
        threat:
          'Even when su is hidden, the framework still has to mount its files into the system. Those mounts are a second, independent indicator that a systemless root framework is installed.',
        bypass:
          "The legacy paths alone miss a modern install: /data/adb is root-only, so File.exists() returns false. The mount check is defeated when the framework unmounts its files for the app — Magisk's DenyList, KernelSU's umount modules.",
        mastg: ['MASTG-TEST-0045', 'MASTG-TEST-0050'],
      },
    },
  },
  bootloader_unlocked: {
    strength: 'strong',
    expected:
      'Fires on any phone whose bootloader you unlocked yourself — including developer test devices. Emulators are skipped.',
    platforms: {
      android: {
        title: 'Bootloader unlocked',
        summary:
          'Reads the verified boot state the bootloader hands to Android.',
        checks:
          'Reads ro.boot.verifiedbootstate (orange = unlocked), ro.boot.flash.locked (0 = unlocked) and ro.boot.vbmeta.device_state (unlocked) from one getprop dump. green (stock, locked) and yellow (locked with your own keys, e.g. GrapheneOS) do not fire. Skipped when the emulator signal fired.',
        threat:
          "An unlocked bootloader boots any software without verifying it — it's the first step to rooting, and to replacing the OS entirely. Play Integrity fails its device verdict for the same reason.",
        bypass:
          'Root frameworks can rewrite these properties for hidden apps (Magisk resetprop, used by Play Integrity Fix-style modules). Hardware-backed key attestation can confirm the real state.',
        mastg: [],
      },
    },
  },
  root_test_keys: {
    strength: 'medium',
    expected: 'Some custom ROMs and emulator images are built with test-keys.',
    platforms: {
      android: {
        title: 'Test-keys build',
        summary:
          "Detects a build signed with Android's public test-keys instead of release-keys.",
        checks:
          'Reads android.os.Build.TAGS and looks for the substring test-keys.',
        threat:
          "A test-keys system image is not the manufacturer's verified build: anyone can produce and sign one, so the OS's own code-integrity guarantees (Verified Boot) do not hold. Custom ROMs commonly ship pre-rooted or with relaxed security.",
        bypass:
          'Build.TAGS is just a system property an attacker with root can set to release-keys; it is a weak, easily-spoofed signal on its own.',
        mastg: ['MASTG-TEST-0045'],
      },
    },
  },
  root_dangerous_props: {
    strength: 'medium',
    platforms: {
      android: {
        title: 'Insecure system properties',
        summary:
          'Reads ro.debuggable and ro.secure via getprop to detect a debuggable / insecure build.',
        checks:
          'Spawns getprop (with a 1-second timeout) for ro.debuggable and ro.secure. A build with ro.debuggable=1 or ro.secure=0 is an engineering/userdebug build with adbd running as root and relaxed restrictions.',
        threat:
          'ro.secure=0 / ro.debuggable=1 means root adb and a debuggable system: an attacker can run arbitrary commands as root over adb and attach to any app. Production devices ship the opposite values.',
        bypass:
          "An attacker with root can set these properties to the 'secure' values (ro.debuggable=0, ro.secure=1) using resetprop (Magisk) so the check sees a clean build.",
        mastg: ['MASTG-TEST-0045'],
      },
    },
  },
  root_rw_system: {
    strength: 'strong',
    platforms: {
      android: {
        title: 'Read-write system partition',
        summary:
          'Parses /proc/self/mounts for system partitions mounted read-write.',
        checks:
          'Reads /proc/mounts and flags any of /system, /system/bin, /system/xbin, /vendor, /sbin, /etc mounted with the rw option.',
        threat:
          'A writable system partition lets an attacker replace system binaries, install persistent backdoors, or patch libraries every app loads. Read-only system is a core Android integrity guarantee.',
        bypass:
          "Magisk's entire design is systemless — it never remounts /system rw, mounting changes through an overlay in /data instead, so this check does not fire on a modern Magisk root.",
        mastg: ['MASTG-TEST-0045', 'MASTG-TEST-0050'],
      },
    },
  },
  hooking_frida: {
    strength: 'strong',
    platforms: {
      android: {
        title: 'Frida instrumentation (Android)',
        summary:
          "Scans the process memory map and thread names for Frida's runtime artifacts.",
        checks:
          'Reads /proc/self/maps and flags mapped regions containing frida-agent, frida-gadget, libfrida, gum-js-loop or linjector.',
        threat:
          'Frida is the dominant runtime-manipulation tool on Android: injected into your process it rewrites any Java or native function, bypassing auth, lifting secrets, and neutering SSL pinning and these very checks. objection automates all of this.',
        bypass:
          "'Stealth' Frida forks rename the agent, randomize the thread name, and map memory anonymously so none of these strings appear in /proc/self/maps.",
        mastg: ['MASTG-TEST-0048'],
      },
    },
  },
  hooking_xposed: {
    strength: 'strong',
    platforms: {
      android: {
        title: 'Xposed / code injection',
        summary:
          'Detects Xposed and LSPosed via loaded libraries, bridge classes, and the call stack.',
        checks:
          'Scans /proc/self/maps for XposedBridge.jar, liblspd, libriru, libsubstrate and libzygisk.',
        threat:
          "Xposed / LSPosed let a 'module' hook arbitrary methods of any app process-wide without modifying the APK — a persistent, reboot-surviving way to patch out security logic, spoof data, or harvest inputs.",
        bypass:
          "Modern LSPosed runs through Zygisk and can hide itself from a target app's class loader and maps, and Shamiko-style hiding further removes its traces.",
        mastg: ['MASTG-TEST-0048', 'MASTG-TEST-0050'],
      },
    },
  },
  tamper_signature_mismatch: {
    strength: 'strong',
    expected:
      'Expected for debug builds signed with the debug keystore when expectedSigningCertificates lists the release certificate.',
    platforms: {
      android: {
        title: 'Signing certificate mismatch',
        summary:
          "Compares the app's current signing certificate SHA-256 against your expected set. Opt-in.",
        checks:
          "Reads the app's signing certificates via PackageManager (GET_SIGNING_CERTIFICATES on API 28+, honoring v3 key rotation via the signing history; GET_SIGNATURES on older APIs), SHA-256-hashes each, and checks whether any matches a digest in your expectedSigningCertificates.",
        threat:
          'Repackaging an app — adding ads/malware, patching out checks, cloning for phishing — requires decoding and rebuilding the APK (e.g. with Apktool), which strips the original signature. The attacker must re-sign with their own key, changing the certificate hash. Pinning your real certificate catches every such repackaged build.',
        bypass:
          "An attacker who roots the device can hook PackageManager.getPackageInfo to return your genuine certificate bytes while the running code is modified — the check trusts the OS's answer.",
        mastg: ['MASTG-TEST-0038'],
      },
    },
  },
  tamper_untrusted_installer: {
    strength: 'medium',
    expected:
      'Expected for builds installed with adb or Android Studio instead of the Play Store.',
    platforms: {
      android: {
        title: 'Untrusted install source',
        summary:
          'Checks which package installed the app against your allow-list (e.g. the Play Store). Opt-in.',
        checks:
          'Reads the installing package via PackageManager.getInstallSourceInfo (API 30+) / getInstallerPackageName (older), and checks it against your allowedInstallers (e.g. com.android.vending for Play, or your MDM).',
        threat:
          'A legitimately distributed app is installed by a trusted store; a sideloaded APK (installed by a browser, a file manager, or adb) is a common delivery path for cracked, repackaged, or trojanized builds. The installer identity is a cheap signal of distribution channel.',
        bypass:
          'The installer attribution can be spoofed: an attacker can install the APK via a session that claims com.android.vending as the installer package.',
        mastg: ['MASTG-TEST-0038'],
      },
    },
  },
  emulator: {
    strength: 'context',
    expected:
      'Expected on the Android emulator. Does not make the status compromised unless treatEmulatorAsCompromised is on.',
    platforms: {
      android: {
        title: 'Android emulator',
        summary:
          'Fingerprints the device against emulator build properties and QEMU artifacts. Requires a strong indicator.',
        checks:
          'Inspects Build.FINGERPRINT/MODEL/MANUFACTURER/HARDWARE/PRODUCT/BRAND/DEVICE for emulator signatures (generic/unknown/sdk_gphone fingerprints, goldfish/ranchu/vbox86 hardware, Genymotion manufacturer, SDK/emulator products) and checks for QEMU device nodes /dev/qemu_pipe and /dev/socket/qemud.',
        threat:
          'Emulators give an attacker a disposable, fully-controlled, easily-scripted device for mass fraud, bot/automation abuse, and reverse engineering. They are standard infrastructure for farming and for scaling attacks that would be impractical on physical hardware.',
        bypass:
          'Anti-detection emulator builds and property-spoofing modules rewrite Build.* fields and remove QEMU nodes to mimic a real device.',
        mastg: ['MASTG-TEST-0049'],
      },
    },
  },
};
