/**
 * @jest-environment node
 */

const mockWithInfoPlist = jest.fn(
  (
    config: Record<string, unknown>,
    action: (c: Record<string, unknown>) => Record<string, unknown>
  ) =>
    action({
      ...config,
      modResults: {},
    })
);

// Runs the Android action against a sample manifest (captured for assertions)
// and hands back the config unchanged, so iOS assertions stay simple.
let lastAndroidManifest: unknown;
const mockWithAndroidManifest = jest.fn(
  (
    config: Record<string, unknown>,
    action: (c: Record<string, unknown>) => Record<string, unknown>
  ) => {
    lastAndroidManifest = action({
      ...config,
      modResults: { manifest: { $: {}, application: [{ $: {} }] } },
    }).modResults;
    return config;
  }
);

jest.mock('expo/config-plugins', () => ({
  withInfoPlist: (
    config: Record<string, unknown>,
    action: (c: Record<string, unknown>) => Record<string, unknown>
  ) => mockWithInfoPlist(config, action),
  withAndroidManifest: (
    config: Record<string, unknown>,
    action: (c: Record<string, unknown>) => Record<string, unknown>
  ) => mockWithAndroidManifest(config, action),
  createRunOncePlugin: <T>(plugin: T) => plugin,
}));

import {
  BOOTLOADER_UNLOCKED_META_DATA,
  JAILBREAK_URL_SCHEMES,
  addJailbreakQueriesSchemes,
  setBootloaderUnlockedMetaData,
  withDeviceIntegrity,
} from '../index';

function manifestWith(metaData?: { name: string; value: string }[]) {
  return {
    manifest: {
      $: {},
      application: [
        {
          $: {},
          ...(metaData == null
            ? {}
            : {
                'meta-data': metaData.map((item) => ({
                  $: { 'android:name': item.name, 'android:value': item.value },
                })),
              }),
        },
      ],
    },
  } as never;
}

function metaDataOf(manifest: unknown) {
  const application = (
    manifest as {
      manifest: {
        application: { 'meta-data'?: { $: Record<string, string> }[] }[];
      };
    }
  ).manifest.application[0];
  return (application?.['meta-data'] ?? []).map((item) => item.$);
}

const ALL_SCHEMES = [...JAILBREAK_URL_SCHEMES];

describe('addJailbreakQueriesSchemes', () => {
  it('adds all schemes to an empty plist', () => {
    expect(addJailbreakQueriesSchemes({})).toEqual({
      LSApplicationQueriesSchemes: ALL_SCHEMES,
    });
  });

  it('preserves existing entries/order and dedupes', () => {
    const result = addJailbreakQueriesSchemes({
      LSApplicationQueriesSchemes: ['https', 'cydia', 'mailto'],
    });

    expect(result.LSApplicationQueriesSchemes).toEqual([
      'https',
      'cydia',
      'mailto',
      'sileo',
      'zbra',
      'filza',
      'undecimus',
      'activator',
    ]);
  });

  it('is idempotent when applied twice', () => {
    const once = addJailbreakQueriesSchemes({});
    const twice = addJailbreakQueriesSchemes(once);
    expect(twice).toEqual(once);
    expect(twice.LSApplicationQueriesSchemes).toEqual(ALL_SCHEMES);
  });

  it('treats a non-array existing value as empty', () => {
    expect(
      addJailbreakQueriesSchemes({
        LSApplicationQueriesSchemes: 'cydia' as unknown as string[],
      })
    ).toEqual({
      LSApplicationQueriesSchemes: ALL_SCHEMES,
    });
  });
});

describe('setBootloaderUnlockedMetaData', () => {
  const OTHER = { name: 'com.example.other', value: 'x' };

  it.each(['report', 'off'] as const)('writes the %s mode', (mode) => {
    expect(
      metaDataOf(setBootloaderUnlockedMetaData(manifestWith([OTHER]), mode))
    ).toEqual([
      { 'android:name': OTHER.name, 'android:value': OTHER.value },
      { 'android:name': BOOTLOADER_UNLOCKED_META_DATA, 'android:value': mode },
    ]);
  });

  it('replaces an existing value instead of duplicating it', () => {
    const manifest = manifestWith([
      { name: BOOTLOADER_UNLOCKED_META_DATA, value: 'off' },
    ]);
    expect(
      metaDataOf(setBootloaderUnlockedMetaData(manifest, 'report'))
    ).toEqual([
      {
        'android:name': BOOTLOADER_UNLOCKED_META_DATA,
        'android:value': 'report',
      },
    ]);
  });

  it.each([undefined, 'compromised'] as const)(
    'removes the entry for the default (%s), keeping others',
    (mode) => {
      const manifest = manifestWith([
        OTHER,
        { name: BOOTLOADER_UNLOCKED_META_DATA, value: 'report' },
      ]);
      expect(metaDataOf(setBootloaderUnlockedMetaData(manifest, mode))).toEqual(
        [{ 'android:name': OTHER.name, 'android:value': OTHER.value }]
      );
    }
  );

  it('rejects an unknown mode', () => {
    expect(() =>
      setBootloaderUnlockedMetaData(manifestWith(), 'ignore' as never)
    ).toThrow(/bootloaderUnlocked must be one of/);
  });

  it('leaves a manifest without <application> untouched', () => {
    const manifest = { manifest: { $: {} } } as never;
    expect(setBootloaderUnlockedMetaData(manifest, 'report')).toBe(manifest);
  });
});

describe('withDeviceIntegrity', () => {
  beforeEach(() => {
    mockWithInfoPlist.mockClear();
    mockWithAndroidManifest.mockClear();
    lastAndroidManifest = undefined;
  });

  it('skips Info.plist changes when jailbreakUrlSchemes is false', () => {
    const config = { name: 'test', slug: 'test' };
    const result = withDeviceIntegrity(config as never, {
      ios: { jailbreakUrlSchemes: false },
    });

    expect(result).toBe(config);
    expect(mockWithInfoPlist).not.toHaveBeenCalled();
  });

  it('writes android.bootloaderUnlocked into the manifest', () => {
    withDeviceIntegrity({ name: 'test', slug: 'test' } as never, {
      android: { bootloaderUnlocked: 'report' },
    });

    expect(mockWithAndroidManifest).toHaveBeenCalledTimes(1);
    expect(metaDataOf(lastAndroidManifest)).toEqual([
      {
        'android:name': BOOTLOADER_UNLOCKED_META_DATA,
        'android:value': 'report',
      },
    ]);
  });

  it('adds no Android meta-data by default', () => {
    withDeviceIntegrity({ name: 'test', slug: 'test' } as never);
    expect(metaDataOf(lastAndroidManifest)).toEqual([]);
  });

  it('registers an iOS infoPlist mod that merges schemes', () => {
    const config = { name: 'test', slug: 'test' };
    const result = withDeviceIntegrity(config as never);

    expect(mockWithInfoPlist).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      modResults: {
        LSApplicationQueriesSchemes: ALL_SCHEMES,
      },
    });
  });
});
