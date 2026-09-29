import { Platform } from 'react-native';
import type { CheckIntegrityOptions, IntegrityResult } from './types';

/**
 * Web / unsupported-platform entry. Must not import the native TurboModule.
 */
export async function checkIntegrity(
  _options?: CheckIntegrityOptions
): Promise<IntegrityResult> {
  return {
    status: 'unknown',
    signals: [],
    platform: Platform.OS,
    reason: 'unsupported_platform',
  };
}
