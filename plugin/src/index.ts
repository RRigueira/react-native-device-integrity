import {
  createRunOncePlugin,
  withAndroidManifest,
  withInfoPlist,
  type AndroidManifest,
  type ConfigPlugin,
  type InfoPlist,
} from 'expo/config-plugins';

// keep in sync with ios/DIIntegrityChecks.m hasJailbreakURLSchemes
export const JAILBREAK_URL_SCHEMES = [
  'cydia',
  'sileo',
  'zbra',
  'filza',
  'undecimus',
  'activator',
] as const;

/** How `bootloader_unlocked` affects status. Default `'compromised'`. */
export type BootloaderUnlockedMode = 'compromised' | 'report' | 'off';

// keep in sync with android/.../BootloaderUnlockedMode.kt
export const BOOTLOADER_UNLOCKED_META_DATA =
  'com.deviceintegrity.bootloader_unlocked';

const BOOTLOADER_UNLOCKED_MODES: readonly BootloaderUnlockedMode[] = [
  'compromised',
  'report',
  'off',
];

export type DeviceIntegrityPluginProps = {
  ios?: {
    /** When false, skip Info.plist changes. Default true. */
    jailbreakUrlSchemes?: boolean;
  };
  android?: {
    /**
     * `'compromised'` (default): an unlocked bootloader makes status compromised.
     * `'report'`: the signal is returned but never compromising on its own.
     * `'off'`: the check doesn't run.
     */
    bootloaderUnlocked?: BootloaderUnlockedMode;
  };
};

/**
 * Merge jailbreak URL schemes into LSApplicationQueriesSchemes.
 * Keeps existing entries/order, appends missing ones, never removes.
 *
 * Android needs nothing — the library AndroidManifest `<queries>` merges
 * automatically via the Gradle manifest merger.
 */
export function addJailbreakQueriesSchemes(infoPlist: InfoPlist): InfoPlist {
  const existing = infoPlist.LSApplicationQueriesSchemes;
  const current: string[] = Array.isArray(existing) ? existing.map(String) : [];
  const seen = new Set(current);

  for (const scheme of JAILBREAK_URL_SCHEMES) {
    if (!seen.has(scheme)) {
      current.push(scheme);
      seen.add(scheme);
    }
  }

  return {
    ...infoPlist,
    LSApplicationQueriesSchemes: current,
  };
}

/**
 * Write (or, for the default `'compromised'`, remove) the `<meta-data>` the
 * native module reads on the main `<application>`.
 */
export function setBootloaderUnlockedMetaData(
  manifest: AndroidManifest,
  mode: BootloaderUnlockedMode | undefined
): AndroidManifest {
  if (mode != null && !BOOTLOADER_UNLOCKED_MODES.includes(mode)) {
    throw new Error(
      `react-native-device-integrity: android.bootloaderUnlocked must be one of ${BOOTLOADER_UNLOCKED_MODES.map(
        (value) => `"${value}"`
      ).join(', ')} (got ${JSON.stringify(mode)})`
    );
  }

  const application = manifest.manifest.application?.[0];
  if (application == null) {
    return manifest;
  }

  const others = (application['meta-data'] ?? []).filter(
    (item) => item.$['android:name'] !== BOOTLOADER_UNLOCKED_META_DATA
  );
  application['meta-data'] =
    mode == null || mode === 'compromised'
      ? others
      : [
          ...others,
          {
            $: {
              'android:name': BOOTLOADER_UNLOCKED_META_DATA,
              'android:value': mode,
            },
          },
        ];

  return manifest;
}

export const withDeviceIntegrity: ConfigPlugin<
  DeviceIntegrityPluginProps | void
> = (config, props) => {
  let result = withAndroidManifest(config, (modConfig) => {
    modConfig.modResults = setBootloaderUnlockedMetaData(
      modConfig.modResults,
      props?.android?.bootloaderUnlocked
    );
    return modConfig;
  });

  if (props?.ios?.jailbreakUrlSchemes !== false) {
    result = withInfoPlist(result, (modConfig) => {
      modConfig.modResults = addJailbreakQueriesSchemes(modConfig.modResults);
      return modConfig;
    });
  }

  return result;
};

const pkg = require('../../package.json') as {
  name: string;
  version: string;
};

export default createRunOncePlugin(withDeviceIntegrity, pkg.name, pkg.version);
