import { Platform } from 'react-native';
import type { NativeIntegrityReport } from '../NativeDeviceIntegrity';

const mockCheckIntegrity = jest.fn<Promise<NativeIntegrityReport>, []>();

let mockNativeDefault: {
  checkIntegrity: () => Promise<NativeIntegrityReport>;
} | null = {
  checkIntegrity: () => mockCheckIntegrity(),
};

jest.mock('../NativeDeviceIntegrity', () => ({
  __esModule: true,
  get default() {
    return mockNativeDefault;
  },
}));

import { checkIntegrity } from '../checkIntegrity.native';

describe('checkIntegrity.native', () => {
  const originalOS = Platform.OS;

  beforeEach(() => {
    mockCheckIntegrity.mockReset();
    mockNativeDefault = {
      checkIntegrity: () => mockCheckIntegrity(),
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
      platform: 'ios',
      reason: 'native_module_unavailable',
    });
    expect(mockCheckIntegrity).not.toHaveBeenCalled();
  });

  it('maps native rejection to native_error', async () => {
    mockCheckIntegrity.mockRejectedValue(new Error('boom'));

    await expect(checkIntegrity()).resolves.toEqual({
      status: 'unknown',
      signals: [],
      platform: 'ios',
      reason: 'native_error',
      error: 'boom',
    });
  });

  it('returns timeout when native does not answer in time', async () => {
    jest.useFakeTimers();
    mockCheckIntegrity.mockImplementation(() => new Promise(() => {}));

    const pending = checkIntegrity({ timeoutMs: 1000 });
    await jest.advanceTimersByTimeAsync(1000);

    await expect(pending).resolves.toEqual({
      status: 'unknown',
      signals: [],
      platform: 'ios',
      reason: 'timeout',
    });
  });

  it('maps not_implemented stub report to unknown', async () => {
    mockCheckIntegrity.mockResolvedValue({
      completed: false,
      reason: 'not_implemented',
      signals: [],
    });

    await expect(checkIntegrity()).resolves.toEqual({
      status: 'unknown',
      signals: [],
      platform: 'ios',
      reason: 'not_implemented',
    });
  });

  it('returns clean for a completed empty report', async () => {
    mockCheckIntegrity.mockResolvedValue({
      completed: true,
      signals: [],
    });

    await expect(checkIntegrity()).resolves.toEqual({
      status: 'clean',
      signals: [],
      platform: 'ios',
    });
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
      platform: 'windows',
      reason: 'unsupported_platform',
    });
    expect(mockCheckIntegrity).not.toHaveBeenCalled();
  });
});
