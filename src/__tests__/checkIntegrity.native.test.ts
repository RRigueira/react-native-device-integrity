import { Platform } from 'react-native';
import type { NativeIntegrityReport } from '../NativeDeviceIntegrity';

const mockCheckIntegrity = jest.fn<
  Promise<NativeIntegrityReport>,
  [unknown?]
>();

let mockNativeDefault: {
  checkIntegrity: (options: unknown) => Promise<NativeIntegrityReport>;
} | null = {
  checkIntegrity: (options: unknown) => mockCheckIntegrity(options),
};

jest.mock('../NativeDeviceIntegrity', () => ({
  __esModule: true,
  get default() {
    return mockNativeDefault;
  },
}));

import {
  checkIntegrity,
  sanitizeNativeOptions,
} from '../checkIntegrity.native';

describe('checkIntegrity.native', () => {
  const originalOS = Platform.OS;

  beforeEach(() => {
    mockCheckIntegrity.mockReset();
    mockNativeDefault = {
      checkIntegrity: (options: unknown) => mockCheckIntegrity(options),
    };
    Platform.OS = 'ios';
  });

  afterEach(() => {
    Platform.OS = originalOS;
    jest.useRealTimers();
  });

  it('returns native_module_unavailable when the module is null', async () => {
    mockNativeDefault = null;

    await expect(checkIntegrity()).resolves.toEqual({
      status: 'unknown',
      signals: [],
      ignored: [],
      durationMs: 0,
      platform: 'ios',
      reason: 'native_module_unavailable',
    });
    expect(mockCheckIntegrity).not.toHaveBeenCalled();
  });

  it('maps native rejection to native_error', async () => {
    mockCheckIntegrity.mockRejectedValue(new Error('boom'));

    const result = await checkIntegrity();
    expect(result).toMatchObject({
      status: 'unknown',
      signals: [],
      ignored: [],
      platform: 'ios',
      reason: 'native_error',
      error: 'boom',
    });
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('returns timeout when native does not answer in time', async () => {
    jest.useFakeTimers();
    mockCheckIntegrity.mockImplementation(() => new Promise(() => {}));

    const pending = checkIntegrity({ timeoutMs: 1000 });
    await jest.advanceTimersByTimeAsync(1000);

    const result = await pending;
    expect(result).toMatchObject({
      status: 'unknown',
      signals: [],
      ignored: [],
      platform: 'ios',
      reason: 'timeout',
    });
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('resolves unknown timeout when timeoutMs is 0', async () => {
    jest.useFakeTimers();
    mockCheckIntegrity.mockImplementation(() => new Promise(() => {}));

    const pending = checkIntegrity({ timeoutMs: 0 });
    await jest.advanceTimersByTimeAsync(0);

    const result = await pending;
    expect(result).toMatchObject({
      status: 'unknown',
      signals: [],
      ignored: [],
      platform: 'ios',
      reason: 'timeout',
    });
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('maps native report with extra unknown fields through resolveStatus', async () => {
    mockCheckIntegrity.mockResolvedValue({
      completed: true,
      signals: [
        {
          id: 'jailbreak_cydia',
          category: 'jailbreak',
          description: 'Cydia',
          extra: 'ignored',
          nested: { a: 1 },
        },
      ],
      futureField: true,
      vendorMeta: { score: 0 },
    } as never);

    const result = await checkIntegrity();
    expect(result).toMatchObject({
      status: 'compromised',
      signals: [
        {
          id: 'jailbreak_cydia',
          category: 'jailbreak',
          description: 'Cydia',
        },
      ],
      ignored: [],
      platform: 'ios',
    });
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('preserves duplicate signal ids as returned by native', async () => {
    mockCheckIntegrity.mockResolvedValue({
      completed: true,
      signals: [
        {
          id: 'jailbreak_cydia',
          category: 'jailbreak',
          description: 'first',
        },
        {
          id: 'jailbreak_cydia',
          category: 'jailbreak',
          description: 'second',
        },
      ],
    });

    const result = await checkIntegrity();
    expect(result.status).toBe('compromised');
    expect(result.signals).toEqual([
      {
        id: 'jailbreak_cydia',
        category: 'jailbreak',
        description: 'first',
      },
      {
        id: 'jailbreak_cydia',
        category: 'jailbreak',
        description: 'second',
      },
    ]);
    expect(result.ignored).toEqual([]);
  });

  it('maps non-Error native rejections to a string error message', async () => {
    mockCheckIntegrity.mockRejectedValue('string-fail');

    const result = await checkIntegrity();
    expect(result).toMatchObject({
      status: 'unknown',
      signals: [],
      ignored: [],
      platform: 'ios',
      reason: 'native_error',
      error: 'string-fail',
    });
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('maps non-string non-Error native rejections to a fallback message', async () => {
    mockCheckIntegrity.mockRejectedValue({ code: 42 });

    const result = await checkIntegrity();
    expect(result).toMatchObject({
      status: 'unknown',
      signals: [],
      ignored: [],
      platform: 'ios',
      reason: 'native_error',
      error: 'Native integrity check failed',
    });
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('maps not_implemented stub report to unknown', async () => {
    mockCheckIntegrity.mockResolvedValue({
      completed: false,
      reason: 'not_implemented',
      signals: [],
    });

    const result = await checkIntegrity();
    expect(result).toMatchObject({
      status: 'unknown',
      signals: [],
      ignored: [],
      platform: 'ios',
      reason: 'not_implemented',
    });
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('returns clean for a completed empty report', async () => {
    mockCheckIntegrity.mockResolvedValue({
      completed: true,
      signals: [],
    });

    const result = await checkIntegrity();
    expect(result).toMatchObject({
      status: 'clean',
      signals: [],
      ignored: [],
      platform: 'ios',
    });
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('returns compromised for jailbreak signals', async () => {
    mockCheckIntegrity.mockResolvedValue({
      completed: true,
      signals: [
        {
          id: 'jailbreak_cydia',
          category: 'jailbreak',
          description: 'Cydia',
        },
      ],
    });

    const result = await checkIntegrity();
    expect(result.status).toBe('compromised');
    expect(result.signals).toHaveLength(1);
    expect(result.ignored).toEqual([]);
  });

  it('keeps emulator as clean by default', async () => {
    mockCheckIntegrity.mockResolvedValue({
      completed: true,
      signals: [
        {
          id: 'simulator',
          category: 'emulator',
          description: 'Simulator',
        },
      ],
    });

    await expect(checkIntegrity()).resolves.toMatchObject({
      status: 'clean',
      ignored: [],
    });
  });

  it('treats emulator as compromised when option is set', async () => {
    mockCheckIntegrity.mockResolvedValue({
      completed: true,
      signals: [
        {
          id: 'simulator',
          category: 'emulator',
          description: 'Simulator',
        },
      ],
    });

    await expect(
      checkIntegrity({ treatEmulatorAsCompromised: true })
    ).resolves.toMatchObject({
      status: 'compromised',
    });
  });

  it('returns unsupported_platform for non-ios/android OS', async () => {
    Platform.OS = 'windows';

    await expect(checkIntegrity()).resolves.toEqual({
      status: 'unknown',
      signals: [],
      ignored: [],
      durationMs: 0,
      platform: 'windows',
      reason: 'unsupported_platform',
    });
    expect(mockCheckIntegrity).not.toHaveBeenCalled();
  });

  it('forwards sanitized android/ios options to native', async () => {
    mockCheckIntegrity.mockResolvedValue({
      completed: true,
      signals: [],
    });

    await checkIntegrity({
      treatEmulatorAsCompromised: true,
      timeoutMs: 5000,
      ignore: ['simulator'],
      android: {
        expectedSigningCertificates: ['Aa:Bb', 42 as unknown as string, 'cc'],
        allowedInstallers: ['com.android.vending', null as unknown as string],
      },
      ios: {
        expectedTeamIds: ['TEAM123', 7 as unknown as string],
        requireEncryptedBinary: true,
      },
    });

    expect(mockCheckIntegrity).toHaveBeenCalledWith({
      android: {
        expectedSigningCertificates: ['Aa:Bb', 'cc'],
        allowedInstallers: ['com.android.vending'],
      },
      ios: {
        expectedTeamIds: ['TEAM123'],
        requireEncryptedBinary: true,
      },
    });
  });

  it('passes an empty object when no android/ios options are set', async () => {
    mockCheckIntegrity.mockResolvedValue({
      completed: true,
      signals: [],
    });

    await checkIntegrity({ treatEmulatorAsCompromised: true });

    expect(mockCheckIntegrity).toHaveBeenCalledWith({});
  });

  it('sanitizeNativeOptions drops empty platform bags and non-boolean flags', () => {
    expect(
      sanitizeNativeOptions({
        android: { expectedSigningCertificates: undefined },
        ios: {
          requireEncryptedBinary: 'yes' as unknown as boolean,
        },
      })
    ).toEqual({});

    // An empty list means "not configured".
    expect(
      sanitizeNativeOptions({ android: { allowedInstallers: [] } })
    ).toEqual({ android: { allowedInstallers: [] } });
  });

  it('sanitizeNativeOptions fails closed on provided but unusable lists', () => {
    // Wrong type or no strings: sent as a blank entry so native reports incomplete.
    expect(
      sanitizeNativeOptions({
        android: {
          expectedSigningCertificates: 'nope' as unknown as string[],
          allowedInstallers: [1, null] as unknown as string[],
        },
        ios: { expectedTeamIds: {} as unknown as string[] },
      })
    ).toEqual({
      android: { expectedSigningCertificates: [''], allowedInstallers: [''] },
      ios: { expectedTeamIds: [''] },
    });

    expect(
      sanitizeNativeOptions({
        android: { expectedSigningCertificates: ['abc'] },
      })
    ).toEqual({
      android: { expectedSigningCertificates: ['abc'] },
    });
  });
});
