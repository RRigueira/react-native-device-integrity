import type { Platform } from 'react-native';
import type {
  CheckIntegrityOptions,
  IntegrityResult,
  Signal,
  SignalCategory,
  SignalId,
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

/** Default compromising set: every category except emulator. */
const DEFAULT_COMPROMISING_CATEGORIES: readonly SignalCategory[] = [
  'jailbreak',
  'root',
  'hooking',
  'debugger',
  'tamper',
  'environment',
];

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

function resolveCompromisingCategories(
  options: CheckIntegrityOptions
): ReadonlySet<SignalCategory> {
  const base =
    options.policy?.compromisingCategories != null
      ? options.policy.compromisingCategories
      : DEFAULT_COMPROMISING_CATEGORIES;

  const set = new Set<SignalCategory>(base);

  if (options.treatEmulatorAsCompromised === true) {
    set.add('emulator');
  }

  return set;
}

function partitionIgnored(
  signals: Signal[],
  ignore: SignalId[] | undefined
): { active: Signal[]; ignored: Signal[] } {
  if (ignore == null || ignore.length === 0) {
    return { active: signals, ignored: [] };
  }

  const ignoreSet = new Set<string>(ignore);
  const active: Signal[] = [];
  const ignored: Signal[] = [];

  for (const signal of signals) {
    if (ignoreSet.has(signal.id)) {
      ignored.push(signal);
    } else {
      active.push(signal);
    }
  }

  return { active, ignored };
}

function malformed(
  platform: typeof Platform.OS,
  error: string
): IntegrityResult {
  return {
    status: 'unknown',
    signals: [],
    ignored: [],
    durationMs: 0,
    platform,
    reason: 'native_error',
    error,
  };
}

/**
 * Maps a native integrity report + options to the public IntegrityResult.
 * Compromise evidence wins over incomplete runs; incomplete/malformed never become 'clean'.
 * `durationMs` is set to 0 here — `checkIntegrity` overwrites with measured wall time.
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

  const allSignals = nativeReport.signals.map(normalizeSignal);
  const { active: signals, ignored } = partitionIgnored(
    allSignals,
    options.ignore
  );
  const completed = nativeReport.completed === true;
  const compromising = resolveCompromisingCategories(options);
  // Build-time app config (e.g. bootloader_unlocked: "report"): the signal is
  // still returned, but never makes the status compromised on its own.
  const reportOnly = new Set(
    Array.isArray(nativeReport.reportOnly)
      ? nativeReport.reportOnly.filter(
          (id): id is string => typeof id === 'string'
        )
      : []
  );

  const hasCompromisingSignal = signals.some(
    (signal) => compromising.has(signal.category) && !reportOnly.has(signal.id)
  );

  if (hasCompromisingSignal) {
    return {
      status: 'compromised',
      signals,
      ignored,
      durationMs: 0,
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
      ignored,
      durationMs: 0,
      platform,
      reason,
    };
  }

  return {
    status: 'clean',
    signals,
    ignored,
    durationMs: 0,
    platform,
  };
}
