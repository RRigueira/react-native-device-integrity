import type { Platform } from 'react-native';
import type {
  CheckIntegrityOptions,
  IntegrityResult,
  Signal,
  SignalCategory,
  UnknownReason,
} from './types';

const SIGNAL_CATEGORIES: ReadonlySet<string> = new Set([
  'jailbreak',
  'root',
  'hooking',
  'debugger',
  'emulator',
  'tamper',
  'environment',
]);

function coerceCategory(category: unknown): SignalCategory {
  if (typeof category === 'string' && SIGNAL_CATEGORIES.has(category)) {
    return category as SignalCategory;
  }
  return 'environment';
}

function normalizeSignal(raw: unknown): Signal {
  if (raw === null || typeof raw !== 'object') {
    return {
      id: 'unknown_signal',
      category: 'environment',
      description: '',
    };
  }

  const signal = raw as Record<string, unknown>;
  const id =
    typeof signal.id === 'string' && signal.id.length > 0
      ? signal.id
      : 'unknown_signal';
  const description =
    typeof signal.description === 'string' ? signal.description : '';

  return {
    id,
    category: coerceCategory(signal.category),
    description,
  };
}

function malformed(
  platform: typeof Platform.OS,
  error: string
): IntegrityResult {
  return {
    status: 'unknown',
    signals: [],
    platform,
    reason: 'native_error',
    error,
  };
}

/**
 * Maps a native integrity report + options to the public IntegrityResult.
 * Compromise evidence wins over incomplete runs; incomplete/malformed never become 'clean'.
 */
export function resolveStatus(
  report: unknown,
  options: CheckIntegrityOptions = {},
  platform: typeof Platform.OS
): IntegrityResult {
  if (report === null || typeof report !== 'object' || Array.isArray(report)) {
    return malformed(platform, 'Malformed native integrity report');
  }

  const nativeReport = report as Record<string, unknown>;

  if (!Array.isArray(nativeReport.signals)) {
    return malformed(platform, 'Malformed native integrity report');
  }

  const signals = nativeReport.signals.map(normalizeSignal);
  const completed = nativeReport.completed === true;
  const treatEmulatorAsCompromised =
    options.treatEmulatorAsCompromised === true;

  const hasNonEmulatorSignal = signals.some(
    (signal) => signal.category !== 'emulator'
  );
  const hasEmulatorSignal = signals.some(
    (signal) => signal.category === 'emulator'
  );

  if (
    hasNonEmulatorSignal ||
    (hasEmulatorSignal && treatEmulatorAsCompromised)
  ) {
    return {
      status: 'compromised',
      signals,
      platform,
    };
  }

  if (!completed) {
    const reason: UnknownReason =
      nativeReport.reason === 'not_implemented'
        ? 'not_implemented'
        : 'incomplete';

    return {
      status: 'unknown',
      signals,
      platform,
      reason,
    };
  }

  return {
    status: 'clean',
    signals,
    platform,
  };
}
