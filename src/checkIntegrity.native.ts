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

export async function checkIntegrity(
  options: CheckIntegrityOptions = {}
): Promise<IntegrityResult> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return {
      status: 'unknown',
      signals: [],
      platform: Platform.OS,
      reason: 'unsupported_platform',
    };
  }

  if (NativeDeviceIntegrity == null) {
    return {
      status: 'unknown',
      signals: [],
      platform: Platform.OS,
      reason: 'native_module_unavailable',
    };
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  try {
    const report = await withTimeout(
      NativeDeviceIntegrity.checkIntegrity(),
      timeoutMs
    );
    return resolveStatus(report, options, Platform.OS);
  } catch (error) {
    if (error instanceof IntegrityTimeoutError) {
      return {
        status: 'unknown',
        signals: [],
        platform: Platform.OS,
        reason: 'timeout',
      };
    }

    const message =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : 'Native integrity check failed';

    return {
      status: 'unknown',
      signals: [],
      platform: Platform.OS,
      reason: 'native_error',
      error: message,
    };
  }
}
