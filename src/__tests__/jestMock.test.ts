/**
 * Tests for the published Jest mock at jest/index.js.
 */

const mock = require('../../jest/index.js') as typeof import('../../jest');

describe('jest mock (react-native-device-integrity/jest)', () => {
  afterEach(() => {
    mock.resetMockIntegrity();
  });

  it('exports SIGNAL_IDS matching the public list length', () => {
    expect(mock.SIGNAL_IDS).toContain('tamper_signature_mismatch');
    expect(mock.SIGNAL_IDS).toContain('debugger_attached');
    expect(mock.SIGNAL_IDS).toContain('bootloader_unlocked');
    expect(mock.SIGNAL_IDS.length).toBeGreaterThanOrEqual(22);
  });

  it('defaults checkIntegrity to a clean result', async () => {
    await expect(mock.checkIntegrity()).resolves.toEqual({
      status: 'clean',
      signals: [],
      ignored: [],
      platform: 'ios',
      durationMs: 0,
    });
  });

  it('setMockIntegrityResult merges onto the default clean result', async () => {
    mock.setMockIntegrityResult({
      status: 'compromised',
      signals: [
        {
          id: 'emulator',
          category: 'emulator',
          description: 'Emulator',
        },
      ],
    });

    await expect(mock.checkIntegrity()).resolves.toEqual({
      status: 'compromised',
      signals: [
        {
          id: 'emulator',
          category: 'emulator',
          description: 'Emulator',
        },
      ],
      ignored: [],
      platform: 'ios',
      durationMs: 0,
    });
  });

  it('resetMockIntegrity restores the default', async () => {
    mock.setMockIntegrityResult({ status: 'unknown', reason: 'timeout' });
    mock.resetMockIntegrity();

    await expect(mock.checkIntegrity()).resolves.toMatchObject({
      status: 'clean',
      signals: [],
      ignored: [],
      durationMs: 0,
    });
  });

  it('useDeviceIntegrity returns the mock result with loading false', async () => {
    mock.setMockIntegrityResult({
      status: 'compromised',
      durationMs: 12,
      signals: [
        {
          id: 'root_su_binary',
          category: 'root',
          description: 'su',
        },
      ],
    });

    const hook = mock.useDeviceIntegrity();
    expect(hook.loading).toBe(false);
    expect(hook.status).toBe('compromised');
    expect(hook.signals).toHaveLength(1);
    expect(hook.result?.durationMs).toBe(12);

    await expect(hook.refresh()).resolves.toMatchObject({
      status: 'compromised',
      durationMs: 12,
    });
  });
});
