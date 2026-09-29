/**
 * Import the default (web) implementation by explicit filename so Jest's RN
 * resolver does not pick `checkIntegrity.native.ts`.
 */
import { Platform } from 'react-native';

jest.mock('../NativeDeviceIntegrity', () => {
  throw new Error('web entry must not load NativeDeviceIntegrity');
});

const { checkIntegrity } =
  require('../checkIntegrity.ts') as typeof import('../checkIntegrity');

describe('checkIntegrity (web)', () => {
  const originalOS = Platform.OS;

  afterEach(() => {
    Platform.OS = originalOS;
  });

  it('returns unknown / unsupported_platform', async () => {
    Platform.OS = 'web';

    await expect(checkIntegrity()).resolves.toEqual({
      status: 'unknown',
      signals: [],
      ignored: [],
      durationMs: 0,
      platform: 'web',
      reason: 'unsupported_platform',
    });
  });

  it('never requires the native module', async () => {
    Platform.OS = 'web';

    await expect(checkIntegrity()).resolves.toMatchObject({
      status: 'unknown',
      reason: 'unsupported_platform',
      ignored: [],
      durationMs: 0,
    });
    expect(() => require('../NativeDeviceIntegrity')).toThrow(
      'web entry must not load NativeDeviceIntegrity'
    );
  });
});
