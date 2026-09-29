'use strict';

/**
 * Jest mock for `react-native-device-integrity`.
 *
 * Usage in a test file:
 *
 *   jest.mock(
 *     'react-native-device-integrity',
 *     () => require('react-native-device-integrity/jest')
 *   );
 */

const SIGNAL_IDS = Object.freeze([
  'simulator',
  'jailbreak_files',
  'jailbreak_url_schemes',
  'jailbreak_symlinks',
  'jailbreak_writable_system',
  'hooking_libraries',
  'hooking_dyld_insert',
  'debugger_attached',
  'emulator',
  'root_su_binary',
  'root_management_apps',
  'root_magisk_files',
  'root_test_keys',
  'root_dangerous_props',
  'root_rw_system',
  'hooking_frida',
  'hooking_xposed',
  'tamper_signature_mismatch',
  'tamper_untrusted_installer',
  'tamper_binary_decrypted',
  'tamper_team_id_mismatch',
]);

function defaultResult() {
  return {
    status: 'clean',
    signals: [],
    ignored: [],
    platform: 'ios',
    durationMs: 0,
  };
}

let mockResult = defaultResult();

function cloneResult(result) {
  return {
    ...result,
    signals: Array.isArray(result.signals) ? result.signals.slice() : [],
    ignored: Array.isArray(result.ignored) ? result.ignored.slice() : [],
  };
}

function setMockIntegrityResult(partial) {
  mockResult = {
    ...mockResult,
    ...partial,
    signals:
      partial && Object.prototype.hasOwnProperty.call(partial, 'signals')
        ? partial.signals
        : mockResult.signals,
    ignored:
      partial && Object.prototype.hasOwnProperty.call(partial, 'ignored')
        ? partial.ignored
        : mockResult.ignored,
  };
}

function resetMockIntegrity() {
  mockResult = defaultResult();
}

function checkIntegrity() {
  return Promise.resolve(cloneResult(mockResult));
}

function useDeviceIntegrity() {
  const result = cloneResult(mockResult);
  return {
    status: result.status,
    signals: result.signals,
    result,
    loading: false,
    refresh: function refresh() {
      return checkIntegrity();
    },
  };
}

module.exports = {
  SIGNAL_IDS,
  checkIntegrity,
  useDeviceIntegrity,
  setMockIntegrityResult,
  resetMockIntegrity,
};
