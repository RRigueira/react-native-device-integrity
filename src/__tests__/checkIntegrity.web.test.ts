/**
 * Import the default (web) implementation by explicit filename so Jest's RN
 * resolver does not pick `checkIntegrity.native.ts`.
 */
import { Platform } from 'react-native';

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
      platform: 'web',
      reason: 'unsupported_platform',
    });
  });
});
