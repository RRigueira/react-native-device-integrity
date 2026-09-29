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

jest.mock('expo/config-plugins', () => ({
  withInfoPlist: (
    config: Record<string, unknown>,
    action: (c: Record<string, unknown>) => Record<string, unknown>
  ) => mockWithInfoPlist(config, action),
  createRunOncePlugin: <T>(plugin: T) => plugin,
}));

import {
  JAILBREAK_URL_SCHEMES,
  addJailbreakQueriesSchemes,
  withDeviceIntegrity,
} from '../index';

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

describe('withDeviceIntegrity', () => {
  beforeEach(() => {
    mockWithInfoPlist.mockClear();
  });

  it('leaves config untouched when jailbreakUrlSchemes is false', () => {
    const config = { name: 'test', slug: 'test' };
    const result = withDeviceIntegrity(config as never, {
      ios: { jailbreakUrlSchemes: false },
    });

    expect(result).toBe(config);
    expect(mockWithInfoPlist).not.toHaveBeenCalled();
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
