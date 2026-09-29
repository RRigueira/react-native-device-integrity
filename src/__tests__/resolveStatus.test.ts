import { resolveStatus } from '../resolveStatus';
import type { NativeIntegrityReport } from '../NativeDeviceIntegrity';

const PLATFORM = 'ios' as const;

describe('resolveStatus', () => {
  it('returns compromised for any non-emulator signal', () => {
    const report: NativeIntegrityReport = {
      completed: true,
      signals: [
        {
          id: 'jailbreak_cydia',
          category: 'jailbreak',
          description: 'Cydia detected',
        },
      ],
    };

    expect(resolveStatus(report, {}, PLATFORM)).toEqual({
      status: 'compromised',
      signals: report.signals,
      platform: PLATFORM,
    });
  });

  it('returns compromised for non-emulator signals even when incomplete', () => {
    const report: NativeIntegrityReport = {
      completed: false,
      reason: 'incomplete',
      signals: [
        {
          id: 'root_su',
          category: 'root',
          description: 'su binary found',
        },
      ],
    };

    expect(resolveStatus(report, {}, PLATFORM).status).toBe('compromised');
  });

  it('returns clean when only emulator signals and treatEmulatorAsCompromised is false', () => {
    const report: NativeIntegrityReport = {
      completed: true,
      signals: [
        {
          id: 'simulator',
          category: 'emulator',
          description: 'Running on simulator',
        },
      ],
    };

    expect(resolveStatus(report, {}, PLATFORM)).toEqual({
      status: 'clean',
      signals: report.signals,
      platform: PLATFORM,
    });
  });

  it('returns compromised for emulator signals when treatEmulatorAsCompromised is true', () => {
    const report: NativeIntegrityReport = {
      completed: true,
      signals: [
        {
          id: 'simulator',
          category: 'emulator',
          description: 'Running on simulator',
        },
      ],
    };

    expect(
      resolveStatus(report, { treatEmulatorAsCompromised: true }, PLATFORM)
        .status
    ).toBe('compromised');
  });

  it('returns unknown/not_implemented when incomplete with that reason', () => {
    const report: NativeIntegrityReport = {
      completed: false,
      reason: 'not_implemented',
      signals: [],
    };

    expect(resolveStatus(report, {}, PLATFORM)).toEqual({
      status: 'unknown',
      signals: [],
      platform: PLATFORM,
      reason: 'not_implemented',
    });
  });

  it('returns unknown/incomplete when completed is false for other reasons', () => {
    const report: NativeIntegrityReport = {
      completed: false,
      reason: 'check_failed',
      signals: [],
    };

    expect(resolveStatus(report, {}, PLATFORM)).toEqual({
      status: 'unknown',
      signals: [],
      platform: PLATFORM,
      reason: 'incomplete',
    });
  });

  it('returns clean for a completed report with no signals', () => {
    const report: NativeIntegrityReport = {
      completed: true,
      signals: [],
    };

    expect(resolveStatus(report, {}, PLATFORM)).toEqual({
      status: 'clean',
      signals: [],
      platform: PLATFORM,
    });
  });

  it('coerces unknown categories to environment', () => {
    const result = resolveStatus(
      {
        completed: true,
        signals: [
          {
            id: 'weird',
            category: 'not_a_real_category',
            description: 'odd',
          },
        ],
      },
      {},
      PLATFORM
    );

    expect(result.signals[0]?.category).toBe('environment');
    expect(result.status).toBe('compromised');
  });

  it('keeps signals with missing or invalid ids as unknown_signal', () => {
    const result = resolveStatus(
      {
        completed: true,
        signals: [
          { id: '', category: 'tamper', description: 'empty id' },
          { id: 42, category: 'debugger', description: 'bad id' },
          { category: 'hooking', description: 'missing id' },
        ],
      },
      {},
      PLATFORM
    );

    expect(result.signals).toHaveLength(3);
    expect(result.signals.every((s) => s.id === 'unknown_signal')).toBe(true);
    expect(result.status).toBe('compromised');
  });

  it('returns unknown/native_error for a non-object payload', () => {
    expect(resolveStatus(null, {}, PLATFORM)).toEqual({
      status: 'unknown',
      signals: [],
      platform: PLATFORM,
      reason: 'native_error',
      error: 'Malformed native integrity report',
    });
    expect(resolveStatus('nope', {}, PLATFORM).reason).toBe('native_error');
  });

  it('returns unknown/native_error when signals is not an array', () => {
    expect(
      resolveStatus({ completed: true, signals: 'bad' }, {}, PLATFORM)
    ).toEqual({
      status: 'unknown',
      signals: [],
      platform: PLATFORM,
      reason: 'native_error',
      error: 'Malformed native integrity report',
    });
  });
});
