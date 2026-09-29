import {
  createRunOncePlugin,
  withInfoPlist,
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

export type DeviceIntegrityPluginProps = {
  ios?: {
    /** When false, skip Info.plist changes. Default true. */
    jailbreakUrlSchemes?: boolean;
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

export const withDeviceIntegrity: ConfigPlugin<
  DeviceIntegrityPluginProps | void
> = (config, props) => {
  if (props?.ios?.jailbreakUrlSchemes === false) {
    return config;
  }

  return withInfoPlist(config, (modConfig) => {
    modConfig.modResults = addJailbreakQueriesSchemes(modConfig.modResults);
    return modConfig;
  });
};

const pkg = require('../../package.json') as {
  name: string;
  version: string;
};

export default createRunOncePlugin(withDeviceIntegrity, pkg.name, pkg.version);
