# react-native-device-integrity

Jailbreak, root, hooking, debugger, emulator and opt-in tamper detection for React Native and Expo.

[![npm version](https://img.shields.io/npm/v/react-native-device-integrity.svg)](https://www.npmjs.com/package/react-native-device-integrity)
[![npm license](https://img.shields.io/npm/l/react-native-device-integrity.svg)](https://www.npmjs.com/package/react-native-device-integrity)
[![CI](https://github.com/RRigueira/react-native-device-integrity/actions/workflows/ci.yml/badge.svg)](https://github.com/RRigueira/react-native-device-integrity/actions/workflows/ci.yml)
[![Expo config plugin](https://img.shields.io/badge/Expo-config%20plugin-4630EB)](https://docs.expo.dev/config-plugins/introduction/)
[![New Architecture](https://img.shields.io/badge/New%20Architecture-required-222)](https://reactnative.dev/docs/the-new-architecture/landing-page)

## What it does / doesn't

**Does:** report client-side signals for jailbreak/root, hooking frameworks, attached debuggers, emulator/simulator environments, and (opt-in) app tampering indicators.

**Doesn't:** send telemetry, make network calls, or request permissions. Client-side only — **not** a replacement for commercial RASP/anti-tamper products or server-side attestation (App Attest / Play Integrity).

## How it compares

A snapshot of popular options, as of September 2026. Check each project for current details.

| | **react-native-device-integrity** | [jail-monkey](https://github.com/GantMan/jail-monkey) | [freeRASP](https://github.com/talsec/Free-RASP-ReactNative) | [expo-device](https://docs.expo.dev/versions/latest/sdk/device/) | [react-native-device-info](https://github.com/react-native-device-info/react-native-device-info) |
| --- | --- | --- | --- | --- | --- |
| Focus | Device integrity signals | Jailbreak/root + device flags | Full RASP / app shielding | Device info | Device info |
| Jailbreak / root | ✅ | ✅ | ✅ | Experimental (`isRootedExperimentalAsync`) | — |
| Hooking frameworks (Frida, Xposed, Substrate) | ✅ iOS + Android | Android: suspicious apps | ✅ | — | — |
| Debugger attached | ✅ | Debug-build check | ✅ | — | — |
| Emulator / simulator | ✅ (reported separately) | — | ✅ | `isDevice` | `isEmulator()` |
| App tampering, unofficial store, screenshots, malware… | Signature, installer (Android); encryption, Team ID (iOS) — opt-in | — | ✅ | — | — |
| Result model | `clean` / `compromised` / `unknown` + signal ids + reason | Booleans | Per-threat callbacks | Boolean / throws | Boolean |
| Failed checks | Reported as `unknown`, never `clean` | Not documented | Not documented | Throws | Not documented |
| Network / telemetry | **None** | None | Security telemetry to Talsec (part of the free plan) | None | None |
| Licence / cost | MIT, fully open source | MIT | MIT wrapper + proprietary SDK; free up to 100k devices | MIT | MIT |
| Architecture | New Architecture (TurboModule) | New + old architecture | Not documented | Expo module | Not documented |
| Expo config plugin | ✅ | — | ✅ | Built in (Expo) | — |

**Pick this library** if you want a small, fully open-source, zero-network check with typed, fail-closed results that you can audit end to end.
**Pick freeRASP** if you need broad RASP coverage (tampering, store, screen capture, malware) and managed reporting, and can accept telemetry and its fair-usage terms.
**Pick jail-monkey** if you also need its extra device flags (mock location, ADB, developer settings) or old-architecture support.
None of these replace server-side attestation (App Attest / Play Integrity) for high-value actions.

## Requirements

- **New Architecture (TurboModule) required** — no old-architecture bridge fallback.
- Developed and tested with **React Native 0.86** and **Expo SDK 57**.
- **iOS 15.1+**, **Android minSdk 24**.
- Older RN (**≥ 0.76**) is expected to work but is not yet tested.
- **Expo Go is not supported** — use a development build / `prebuild`.

## Installation

### Expo

```sh
npx expo install react-native-device-integrity
```

Add the config plugin to `app.json` / `app.config.js`:

```json
{
  "expo": {
    "plugins": ["react-native-device-integrity"]
  }
}
```

To skip Info.plist URL-scheme entries (e.g. you manage them yourself):

```json
{
  "expo": {
    "plugins": [
      [
        "react-native-device-integrity",
        { "ios": { "jailbreakUrlSchemes": false } }
      ]
    ]
  }
}
```

Then run `npx expo prebuild` or use a development build. Expo Go is not supported.

### Bare React Native

```sh
npm install react-native-device-integrity
# or: yarn add react-native-device-integrity

cd ios && pod install
```

On iOS, add these schemes under `LSApplicationQueriesSchemes` in `Info.plist`:

`cydia`, `sileo`, `zbra`, `filza`, `undecimus`, `activator`

Without them, `canOpenURL` cannot query those schemes and the URL-scheme check **silently finds nothing**.

Android needs no extra setup — the library manifest `<queries>` list merges automatically via the Gradle manifest merger.

## Usage

```ts
import {
  checkIntegrity,
  useDeviceIntegrity,
  SIGNAL_IDS,
} from 'react-native-device-integrity';

const result = await checkIntegrity({
  treatEmulatorAsCompromised: false,
  timeoutMs: 10_000,
  ignore: ['debugger_attached'],
  policy: { compromisingCategories: ['jailbreak', 'root', 'hooking', 'tamper'] },
  android: {
    expectedSigningCertificates: ['…sha256 hex…'],
    allowedInstallers: ['com.android.vending'],
  },
  ios: {
    expectedTeamIds: ['ABCDE12345'],
    requireEncryptedBinary: true,
  },
});
// result.status: 'clean' | 'compromised' | 'unknown'
// result.ignored, result.durationMs
```

```tsx
import { Button, Text, View } from 'react-native';

function IntegrityStatus() {
  const { status, signals, result, loading, refresh } = useDeviceIntegrity();

  if (loading && result == null) {
    return <Text>Checking…</Text>; // first check in flight
  }

  return (
    <View>
      <Text>Status: {status}</Text>
      {signals.map((signal) => (
        <Text key={signal.id}>{signal.id}</Text>
      ))}
      <Button title="Re-check" onPress={refresh} disabled={loading} />
    </View>
  );
}
```

## API reference

### `checkIntegrity(options?) → Promise<IntegrityResult>`

Never rejects. Failures map to `status: 'unknown'` with a `reason`.

#### `CheckIntegrityOptions`

| Option | Default | Description |
| --- | --- | --- |
| `treatEmulatorAsCompromised` | `false` | Shorthand that unions `'emulator'` into the compromising category set. When `false`, emulator/simulator signals are reported but do not compromise (unless listed in `policy`). |
| `timeoutMs` | `10000` | Resolve as `'unknown'` with reason `'timeout'` if native does not answer in time. |
| `ignore` | `undefined` | `SignalId[]` — matching signals are removed from `signals`, moved to `result.ignored`, and never affect status. |
| `policy.compromisingCategories` | every category except `'emulator'` | Categories that make status `'compromised'`. When both `policy` and `treatEmulatorAsCompromised` are set, the sets are **unioned**. An empty list means no signal can make the status `'compromised'`; use it only deliberately. |
| `android.expectedSigningCertificates` | unset | SHA-256 digests of expected signing certificates (hex; colons/whitespace optional). Check runs only when non-empty. |
| `android.allowedInstallers` | unset | Allowed installer package names. Check runs only when non-empty. A null/unknown installer (e.g. adb/sideload) counts as untrusted. |
| `ios.expectedTeamIds` | unset | Expected Apple Team IDs. Check runs only when non-empty. |
| `ios.requireEncryptedBinary` | unset | When `true`, require the main executable to be encrypted. |

Tamper checks run **only** when their option is provided and non-empty (or `true`). Not configured ⇒ the check does not run and does **not** make the report incomplete.

#### `IntegrityResult`

| Field | Type | Description |
| --- | --- | --- |
| `status` | `'clean' \| 'compromised' \| 'unknown'` | Resolved status (see [Result semantics](#result-semantics)). |
| `signals` | `Signal[]` | Detected signals after `ignore` filtering (may be empty). |
| `ignored` | `Signal[]` | Signals removed by `ignore` (always present; possibly empty). |
| `durationMs` | `number` | Wall time of the check measured in JS (`performance.now()` when available, else `Date.now()`). `0` on unsupported platforms. |
| `platform` | `Platform.OS` | Platform the check ran on. |
| `reason?` | `UnknownReason` | Present when `status` is `'unknown'`. |
| `error?` | `string` | Optional message (e.g. native error text). |

#### `Signal`

| Field | Type |
| --- | --- |
| `id` | `SignalId \| (string & {})` (autocomplete for known ids; unknown future ids accepted) |
| `category` | `SignalCategory` |
| `description` | `string` (generic; never includes matched paths/packages) |

#### `SIGNAL_IDS` / `SignalId`

`SIGNAL_IDS` is a readonly tuple of every known signal id. `SignalId` is `(typeof SIGNAL_IDS)[number]`.

#### `SignalCategory`

`'jailbreak'` | `'root'` | `'hooking'` | `'debugger'` | `'emulator'` | `'tamper'` | `'environment'`

A native category the JS layer doesn't recognise is reported as `environment`, never dropped. `tamper` is used by the opt-in tamper checks below.

#### `UnknownReason`

| Reason | When |
| --- | --- |
| `unsupported_platform` | `Platform.OS` is not `ios` or `android` (e.g. web). |
| `native_module_unavailable` | TurboModule is missing / null (wrong arch, Expo Go, failed link). |
| `native_error` | Native call threw/rejected, or the native report was malformed. |
| `timeout` | Native did not answer within `timeoutMs`. |
| `incomplete` | Native finished with `completed: false` (a check threw; compromise evidence still wins if any non-ignored compromising signal is present). |
| `not_implemented` | Native report has `completed: false` and `reason: 'not_implemented'` (stub / unfinished native path). |

### `useDeviceIntegrity(options?)`

Returns:

| Field | Type | Description |
| --- | --- | --- |
| `status` | `IntegrityStatus` | `result?.status ?? 'unknown'` |
| `signals` | `Signal[]` | `result?.signals ?? []` |
| `result` | `IntegrityResult \| null` | Latest completed result (null until first check finishes). |
| `loading` | `boolean` | `true` while a check is in flight. |
| `refresh` | `() => Promise<IntegrityResult>` | Run another check. |

Behaviour:

- Runs on mount.
- Re-checks when the app returns to the foreground (`background`/`inactive` → `active`).
- Re-checks when options change **by value** (stable key) — inline object literals with the same contents do not loop.
- Latest-request-wins (stale responses are ignored).
- Keeps the previous `result` while refreshing (`loading` is `true`, `result` is not cleared).

## Result semantics

Status is resolved from the native report + options:

1. Apply `ignore` — matching signals move to `ignored` and never affect status.
2. Build the compromising category set: `policy.compromisingCategories` if provided, otherwise every category except `'emulator'`. Union `'emulator'` when `treatEmulatorAsCompromised` is `true`.
3. **Compromise evidence wins** — any non-ignored signal whose category is in that set → `'compromised'`, even if the run was incomplete.
4. Non-compromising, non-ignored signals (e.g. emulator by default) stay in `signals` but do not change status.
5. If the run did not complete (`completed: false`) and there is no compromising evidence → `'unknown'`.
6. Otherwise → `'clean'`.

**`unknown` is never `clean`.** Incomplete, timed-out, missing-module, and unsupported-platform outcomes must not be treated as a safe device.

## Recommended fail-closed usage

Treat only `'clean'` as safe. Block or degrade on both `'compromised'` and `'unknown'`. Re-check on foreground (the hook does this). For high-value actions, pair with server-side attestation.

```tsx
function IntegrityGate({ children }: { children: React.ReactNode }) {
  const { status, result, loading } = useDeviceIntegrity();

  if (loading && result == null) {
    return null; // or a spinner — do not flash protected UI
  }

  if (status === 'clean') {
    return <>{children}</>;
  }

  // Block or degrade for both 'compromised' and 'unknown'
  return <BlockedScreen status={status} />;
}
```

## Testing with Jest

Ship a CommonJS mock that never loads native code:

```ts
jest.mock(
  'react-native-device-integrity',
  () => require('react-native-device-integrity/jest')
);
```

Helpers:

```ts
import {
  checkIntegrity,
  useDeviceIntegrity,
  setMockIntegrityResult,
  resetMockIntegrity,
  SIGNAL_IDS,
} from 'react-native-device-integrity/jest';

beforeEach(() => {
  resetMockIntegrity();
});

it('blocks compromised devices', async () => {
  setMockIntegrityResult({
    status: 'compromised',
    signals: [
      {
        id: 'jailbreak_files',
        category: 'jailbreak',
        description: 'Unexpected system paths',
      },
    ],
  });

  const result = await checkIntegrity();
  expect(result.status).toBe('compromised');
});
```

`setMockIntegrityResult(partial)` merges onto a default clean result (`status: 'clean'`, empty `signals` / `ignored`, `platform: 'ios'`, `durationMs: 0`). `useDeviceIntegrity` returns `{ status, signals, result, loading: false, refresh }` from the current mock result.

## Validating on a real device

Unit tests and the Jest mock prove your app's logic; to see the native checks fire, run them against a real, prepared device. The example app ships an **opt-in Frida Gadget build** for testing hooking detection on a stock iPhone — no jailbreak needed:

```sh
# 1. Download frida-gadget-<version>-ios-universal.dylib.xz from
#    https://github.com/frida/frida/releases, unpack it and save it as
#    example/frida/FridaGadget.dylib (gitignored)
# 2. Regenerate the iOS project with the gadget wired in
yarn example prebuild:frida
# 3. Open example/ios/DeviceIntegrityExample.xcworkspace, pick your signing team
#    (a free Personal Team works) and a physical iPhone, then Run
```

The [`with-frida-gadget`](example/plugins/with-frida-gadget.js) config plugin does nothing unless `FRIDA_GADGET=1` is set. When it is, it links the gadget on device builds only, embeds and signs it, writes a gadget config that starts the app normally (`on_load: resume`, `code_signing: required` — required on a stock device without a debugger), and sets the scheme to Release without LLDB. `yarn example prebuild:ios` regenerates a clean project.

Observed on an iPhone XS Max (A12, iOS 18.7.10, stock): `status: compromised` with a single signal, **`hooking_libraries`**. Launched from Xcode with the debugger attached, the same build also reports `debugger_attached` and `hooking_dyld_insert` (Xcode injects its view-debugging library) — expected, not false positives.

The project site's testing guides cover this step by step (including free vs paid Apple accounts and troubleshooting), plus rooting an Android test device and jailbreaking an iPhone (palera1n on A9–A11, Dopamine on supported A12+ builds).

## Signal reference

Descriptions are generic on purpose (no matched paths or package names).

### iOS

| id | category | Checks |
| --- | --- | --- |
| `simulator` | `emulator` | Running on the iOS Simulator. |
| `jailbreak_files` | `jailbreak` | Unexpected system paths associated with jailbreaks. |
| `jailbreak_url_schemes` | `jailbreak` | Jailbreak-related URL schemes are registered (`canOpenURL`). |
| `jailbreak_symlinks` | `jailbreak` | Unexpected symbolic links in system locations. |
| `jailbreak_writable_system` | `jailbreak` | A normally read-only system location is writable. |
| `hooking_libraries` | `hooking` | Suspicious dynamic libraries are loaded. |
| `hooking_dyld_insert` | `hooking` | `DYLD_INSERT_LIBRARIES` is set in the process environment. |
| `debugger_attached` | `debugger` | A debugger is attached to the process. |
| `tamper_binary_decrypted` | `tamper` | Main executable encryption (`LC_ENCRYPTION_INFO`) reports decrypted / missing (opt-in). |
| `tamper_team_id_mismatch` | `tamper` | App Team ID is not in `expectedTeamIds` (opt-in). |

### Android

| id | category | Checks |
| --- | --- | --- |
| `emulator` | `emulator` | Device appears to be an emulator. |
| `root_su_binary` | `root` | A privileged elevation binary was found. |
| `root_management_apps` | `root` | A root or privilege-management app is installed. |
| `root_magisk_files` | `root` | Root framework artifacts were detected. |
| `root_test_keys` | `root` | Build was signed with test keys. |
| `root_dangerous_props` | `root` | System security properties indicate an insecure build. |
| `root_rw_system` | `root` | A system partition is mounted read-write. |
| `hooking_frida` | `hooking` | Instrumentation framework artifacts were detected. |
| `hooking_xposed` | `hooking` | Code-injection framework artifacts were detected. |
| `debugger_attached` | `debugger` | A debugger is attached to the process. |
| `tamper_signature_mismatch` | `tamper` | None of the app's signing certificates match `expectedSigningCertificates` (opt-in). |
| `tamper_untrusted_installer` | `tamper` | Installer package is not in `allowedInstallers` (opt-in; null/unknown counts as untrusted). |

### Tamper checks (opt-in)

These checks run only when you pass the corresponding options. They do not run by default and do not make an otherwise complete report incomplete.

**Android — signing certificates**

- Get the SHA-256 of the signing certificate with `keytool -printcert -jarfile app.apk`, or from Play Console → App signing → “App signing key certificate” SHA-256.
- For Play Store builds, use the **Play App Signing** key digest (not necessarily the upload key).
- Digests are hex, case-insensitive; colons and whitespace are optional (normalized before compare).

**Android — allowed installers**

- Typical Play Store value: `com.android.vending`.
- A null/unknown installer (adb / sideload) is treated as untrusted.
- **Only enable in release builds** — debug installs via adb will always fail this check.

**iOS — Team ID**

- Use the Team ID from your [Apple Developer](https://developer.apple.com/account) account (the keychain access-group prefix).

**iOS — encrypted binary**

- `requireEncryptedBinary: true` is appropriate for **App Store / TestFlight** builds only.
- **Never** enable for debug, development, or ad-hoc builds (those binaries are typically unencrypted).

### Notes

- On the **iOS Simulator**, filesystem / URL-scheme / symlink / writable-system and `DYLD_INSERT_LIBRARIES` checks are **skipped** (they would inspect the host Mac). Skipped-by-design is not incomplete; hooking-library and debugger checks still run, plus the `simulator` signal.
- `debugger_attached` fires whenever a debugger is attached, including during normal Xcode / Android Studio debugging.
- Running from Xcode with the debugger also sets `DYLD_INSERT_LIBRARIES` (Xcode's view-debugging support library), so `hooking_dyld_insert` fires too. Launch from the home screen, or untick *Debug executable* in the scheme, to see the production result.
- Android emulators still run root checks (they may report root-related signals independently of `emulator`).

## Limitations & threat model

These are **client-side risk indicators**. They can be bypassed by an attacker who controls the device, for example:

- Frida / objection hooking this module
- Rootless jailbreaks with hiding tweaks
- Magisk DenyList / Zygisk / Shamiko
- KernelSU hiding

Never rely on them alone for security decisions. For high-assurance flows, use **Apple App Attest / DeviceCheck** and the **Google Play Integrity API** server-side.

**Possible false positives:** custom ROMs, developer devices with test-keys builds, enterprise MDM environments.

**Store review:** no private APIs; no `QUERY_ALL_PACKAGES` (scoped `<queries>` list); no required-reason file-timestamp APIs; ships a [privacy manifest](ios/PrivacyInfo.xcprivacy) declaring no data collection.

## Privacy

Nothing leaves the device. No data collection. No network access. Checks run locally and return an in-process result only.

## Credits & prior art

- [OWASP MASVS / MASTG](https://mas.owasp.org/) (resilience / MASVS-RESILIENCE)
- [IOSSecuritySuite](https://github.com/securing/IOSSecuritySuite) by SecuRing (Wojciech Reguła) — Check categories and indicator lists were informed by version 1.9.11 and earlier, which are licensed BSD-2-Clause. Versions 2.0.0 and later are distributed under a proprietary EULA and were not used. No source code was copied.
- [RootBeer](https://github.com/scottyab/rootbeer) by Scott Alexander-Bown and contributors — Apache-2.0 — check categories and indicator lists informed by; independent implementation, no source code copied.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Security

See [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)
