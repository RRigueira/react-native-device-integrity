import { Platform } from 'react-native';
import NativeDeviceIntegrity from './NativeDeviceIntegrity';
import { resolveStatus } from './resolveStatus';
import type { CheckIntegrityOptions, IntegrityResult } from './types';

const DEFAULT_TIMEOUT_MS = 10_000;

class IntegrityTimeoutError extends Error {
  constructor() {
    super('Device integrity check timed out');
    this.name = 'IntegrityTimeoutError';
  }
}

function nowMs(): number {
  const perf = (globalThis as { performance?: { now?: () => number } })
    .performance;
  if (perf != null && typeof perf.now === 'function') {
    return perf.now();
  }
  return Date.now();
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new IntegrityTimeoutError());
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

// A blank entry makes native treat the check as configured but unusable,
// so it reports the run as incomplete instead of skipping the check.
const UNUSABLE_LIST = [''];

function stringArray(value: unknown): string[] | undefined {
  if (value == null) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    return UNUSABLE_LIST;
  }
  const strings = value.filter(
    (item): item is string => typeof item === 'string'
  );
  if (value.length > 0 && strings.length === 0) {
    return UNUSABLE_LIST;
  }
  return strings;
}

/**
 * Build the native options bag: only `android` / `ios`, with sanitized fields.
 * Missing fields are omitted. A list that is provided but unusable (wrong type,
 * no strings) is sent as a blank entry so the check fails closed as incomplete.
 */
export function sanitizeNativeOptions(
  options: CheckIntegrityOptions
): Record<string, unknown> {
  const native: Record<string, unknown> = {};

  if (options.android != null && typeof options.android === 'object') {
    const android: Record<string, unknown> = {};
    const certs = stringArray(options.android.expectedSigningCertificates);
    if (certs != null) {
      android.expectedSigningCertificates = certs;
    }
    const installers = stringArray(options.android.allowedInstallers);
    if (installers != null) {
      android.allowedInstallers = installers;
    }
    if (Object.keys(android).length > 0) {
      native.android = android;
    }
  }

  if (options.ios != null && typeof options.ios === 'object') {
    const ios: Record<string, unknown> = {};
    const teamIds = stringArray(options.ios.expectedTeamIds);
    if (teamIds != null) {
      ios.expectedTeamIds = teamIds;
    }
    if (typeof options.ios.requireEncryptedBinary === 'boolean') {
      ios.requireEncryptedBinary = options.ios.requireEncryptedBinary;
    }
    if (Object.keys(ios).length > 0) {
      native.ios = ios;
    }
  }

  return native;
}

function withDuration(
  result: IntegrityResult,
  startedAt: number
): IntegrityResult {
  return {
    ...result,
    durationMs: Math.max(0, nowMs() - startedAt),
  };
}

export async function checkIntegrity(
  options: CheckIntegrityOptions = {}
): Promise<IntegrityResult> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return {
      status: 'unknown',
      signals: [],
      ignored: [],
      durationMs: 0,
      platform: Platform.OS,
      reason: 'unsupported_platform',
    };
  }

  if (NativeDeviceIntegrity == null) {
    return {
      status: 'unknown',
      signals: [],
      ignored: [],
      durationMs: 0,
      platform: Platform.OS,
      reason: 'native_module_unavailable',
    };
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const startedAt = nowMs();
  const nativeOptions = sanitizeNativeOptions(options);

  try {
    const report = await withTimeout(
      NativeDeviceIntegrity.checkIntegrity(nativeOptions),
      timeoutMs
    );
    return withDuration(resolveStatus(report, options, Platform.OS), startedAt);
  } catch (error) {
    if (error instanceof IntegrityTimeoutError) {
      return withDuration(
        {
          status: 'unknown',
          signals: [],
          ignored: [],
          durationMs: 0,
          platform: Platform.OS,
          reason: 'timeout',
        },
        startedAt
      );
    }

    const message =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : 'Native integrity check failed';

    return withDuration(
      {
        status: 'unknown',
        signals: [],
        ignored: [],
        durationMs: 0,
        platform: Platform.OS,
        reason: 'native_error',
        error: message,
      },
      startedAt
    );
  }
}
