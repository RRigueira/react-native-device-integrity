import { resolveStatus } from '../resolveStatus';
import type { NativeIntegrityReport } from '../NativeDeviceIntegrity';
import type { IntegrityResult } from '../types';

const PLATFORM = 'ios' as const;

function expectResult(
  actual: IntegrityResult,
  expected: Omit<IntegrityResult, 'durationMs'> & { durationMs?: number }
) {
  expect(actual).toEqual({
    durationMs: 0,
    ...expected,
  });
}

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

    expectResult(resolveStatus(report, {}, PLATFORM), {
      status: 'compromised',
      signals: [
        {
          id: 'jailbreak_cydia',
          category: 'jailbreak',
          description: 'Cydia detected',
        },
      ],
      ignored: [],
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

  it('treats bootloader_unlocked (environment) as compromising by default, but it can be ignored', () => {
    const report: NativeIntegrityReport = {
      completed: true,
      signals: [
        {
          id: 'bootloader_unlocked',
          category: 'environment',
          description: 'The device bootloader is unlocked',
        },
      ],
    };

    expect(resolveStatus(report, {}, 'android').status).toBe('compromised');

    const ignored = resolveStatus(
      report,
      { ignore: ['bootloader_unlocked'] },
      'android'
    );
    expect(ignored.status).toBe('clean');
    expect(ignored.ignored.map((signal) => signal.id)).toEqual([
      'bootloader_unlocked',
    ]);
  });

  it('keeps report-only signals (build-time config) in signals without compromising', () => {
    const signal = {
      id: 'bootloader_unlocked',
      category: 'environment',
      description: 'The device bootloader is unlocked',
    };

    const reportOnly = resolveStatus(
      {
        completed: true,
        signals: [signal],
        reportOnly: ['bootloader_unlocked'],
      },
      {},
      'android'
    );
    expect(reportOnly.status).toBe('clean');
    expect(reportOnly.signals).toEqual([signal]);

    // Other compromising evidence still wins.
    const withRoot = resolveStatus(
      {
        completed: true,
        signals: [
          signal,
          { id: 'root_su_binary', category: 'root', description: 'su' },
        ],
        reportOnly: ['bootloader_unlocked'],
      },
      {},
      'android'
    );
    expect(withRoot.status).toBe('compromised');

    // Malformed reportOnly is ignored (fails closed).
    expect(
      resolveStatus(
        {
          completed: true,
          signals: [signal],
          reportOnly: 'bootloader_unlocked' as unknown as string[],
        },
        {},
        'android'
      ).status
    ).toBe('compromised');
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

    expectResult(resolveStatus(report, {}, PLATFORM), {
      status: 'clean',
      signals: [
        {
          id: 'simulator',
          category: 'emulator',
          description: 'Running on simulator',
        },
      ],
      ignored: [],
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

    expectResult(resolveStatus(report, {}, PLATFORM), {
      status: 'unknown',
      signals: [],
      ignored: [],
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

    expectResult(resolveStatus(report, {}, PLATFORM), {
      status: 'unknown',
      signals: [],
      ignored: [],
      platform: PLATFORM,
      reason: 'incomplete',
    });
  });

  it('returns clean for a completed report with no signals', () => {
    const report: NativeIntegrityReport = {
      completed: true,
      signals: [],
    };

    expectResult(resolveStatus(report, {}, PLATFORM), {
      status: 'clean',
      signals: [],
      ignored: [],
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
    expect(result.ignored).toEqual([]);
  });

  it('coerces non-string and missing native categories to environment', () => {
    const result = resolveStatus(
      {
        completed: true,
        signals: [
          { id: 'a', category: 123, description: 'num' },
          { id: 'b', description: 'missing category' },
          { id: 'c', category: null, description: 'null category' },
        ],
      },
      {},
      PLATFORM
    );

    expect(result.signals.map((s) => s.category)).toEqual([
      'environment',
      'environment',
      'environment',
    ]);
    expect(result.status).toBe('compromised');
  });

  it('normalizes non-object signal entries and preserves duplicate ids', () => {
    const result = resolveStatus(
      {
        completed: true,
        signals: [
          null,
          'bad',
          {
            id: 'dup',
            category: 'root',
            description: 'one',
          },
          {
            id: 'dup',
            category: 'root',
            description: 'two',
          },
        ],
      },
      {},
      PLATFORM
    );

    expect(result.signals).toEqual([
      {
        id: 'unknown_signal',
        category: 'environment',
        description: '',
      },
      {
        id: 'unknown_signal',
        category: 'environment',
        description: '',
      },
      {
        id: 'dup',
        category: 'root',
        description: 'one',
      },
      {
        id: 'dup',
        category: 'root',
        description: 'two',
      },
    ]);
    expect(result.status).toBe('compromised');
  });

  it('ignores extra unknown fields on the native report', () => {
    const result = resolveStatus(
      {
        completed: true,
        signals: [
          {
            id: 'simulator',
            category: 'emulator',
            description: 'Simulator',
            mystery: true,
          },
        ],
        schemaVersion: 99,
        unused: ['x'],
      },
      {},
      PLATFORM
    );

    expectResult(result, {
      status: 'clean',
      signals: [
        {
          id: 'simulator',
          category: 'emulator',
          description: 'Simulator',
        },
      ],
      ignored: [],
      platform: PLATFORM,
    });
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
    expectResult(resolveStatus(null, {}, PLATFORM), {
      status: 'unknown',
      signals: [],
      ignored: [],
      platform: PLATFORM,
      reason: 'native_error',
      error: 'Malformed native integrity report',
    });
    expect(resolveStatus('nope', {}, PLATFORM).reason).toBe('native_error');
  });

  it('returns unknown/native_error when signals is not an array', () => {
    expectResult(
      resolveStatus({ completed: true, signals: 'bad' }, {}, PLATFORM),
      {
        status: 'unknown',
        signals: [],
        ignored: [],
        platform: PLATFORM,
        reason: 'native_error',
        error: 'Malformed native integrity report',
      }
    );
  });

  it('moves ignored signal ids out of signals and does not compromise', () => {
    const report: NativeIntegrityReport = {
      completed: true,
      signals: [
        {
          id: 'jailbreak_files',
          category: 'jailbreak',
          description: 'Unexpected system paths',
        },
        {
          id: 'simulator',
          category: 'emulator',
          description: 'Simulator',
        },
      ],
    };

    const result = resolveStatus(
      report,
      { ignore: ['jailbreak_files'] },
      PLATFORM
    );

    expect(result.status).toBe('clean');
    expect(result.signals).toEqual([
      {
        id: 'simulator',
        category: 'emulator',
        description: 'Simulator',
      },
    ]);
    expect(result.ignored).toEqual([
      {
        id: 'jailbreak_files',
        category: 'jailbreak',
        description: 'Unexpected system paths',
      },
    ]);
  });

  it('treats tamper category as compromising by default', () => {
    const result = resolveStatus(
      {
        completed: true,
        signals: [
          {
            id: 'tamper_signature_mismatch',
            category: 'tamper',
            description: 'Signing certificate mismatch',
          },
        ],
      },
      {},
      PLATFORM
    );

    expect(result.status).toBe('compromised');
  });

  it('uses policy.compromisingCategories as the compromising set', () => {
    const report: NativeIntegrityReport = {
      completed: true,
      signals: [
        {
          id: 'jailbreak_files',
          category: 'jailbreak',
          description: 'paths',
        },
        {
          id: 'debugger_attached',
          category: 'debugger',
          description: 'debugger',
        },
      ],
    };

    const result = resolveStatus(
      report,
      { policy: { compromisingCategories: ['debugger'] } },
      PLATFORM
    );

    expect(result.status).toBe('compromised');
    expect(result.signals).toHaveLength(2);
  });

  it('policy without jailbreak leaves jailbreak as non-compromising', () => {
    const result = resolveStatus(
      {
        completed: true,
        signals: [
          {
            id: 'jailbreak_files',
            category: 'jailbreak',
            description: 'paths',
          },
        ],
      },
      { policy: { compromisingCategories: ['root'] } },
      PLATFORM
    );

    expect(result.status).toBe('clean');
    expect(result.signals).toHaveLength(1);
  });

  it('unions treatEmulatorAsCompromised with policy.compromisingCategories', () => {
    const report: NativeIntegrityReport = {
      completed: true,
      signals: [
        {
          id: 'simulator',
          category: 'emulator',
          description: 'Simulator',
        },
      ],
    };

    const withoutFlag = resolveStatus(
      report,
      { policy: { compromisingCategories: ['jailbreak'] } },
      PLATFORM
    );
    expect(withoutFlag.status).toBe('clean');

    const withFlag = resolveStatus(
      report,
      {
        policy: { compromisingCategories: ['jailbreak'] },
        treatEmulatorAsCompromised: true,
      },
      PLATFORM
    );
    expect(withFlag.status).toBe('compromised');
  });

  it('always includes ignored: [] and durationMs: 0 from resolveStatus', () => {
    const result = resolveStatus(
      { completed: true, signals: [] },
      {},
      PLATFORM
    );
    expect(result.ignored).toEqual([]);
    expect(result.durationMs).toBe(0);
  });
});
