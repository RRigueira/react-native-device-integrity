import type { Platform } from 'react-native';

export type IntegrityStatus = 'clean' | 'compromised' | 'unknown';

export type SignalCategory =
  | 'jailbreak'
  | 'root'
  | 'hooking'
  | 'debugger'
  | 'emulator'
  | 'tamper'
  | 'environment';

/**
 * Stable public signal ids. Unknown future ids remain accepted on `Signal.id`.
 */
export const SIGNAL_IDS = [
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
] as const;

export type SignalId = (typeof SIGNAL_IDS)[number];

export interface Signal {
  /** Known ids autocomplete; unknown future ids are still accepted. */
  id: SignalId | (string & {});
  category: SignalCategory;
  description: string;
}

export type UnknownReason =
  | 'unsupported_platform'
  | 'native_module_unavailable'
  | 'native_error'
  | 'timeout'
  | 'incomplete'
  | 'not_implemented';

export interface IntegrityResult {
  status: IntegrityStatus;
  signals: Signal[];
  /** Signals removed by `ignore` — never affect status. Always present. */
  ignored: Signal[];
  /** Wall time of the check in JS (monotonic when available). 0 on unsupported platforms. */
  durationMs: number;
  platform: typeof Platform.OS;
  reason?: UnknownReason;
  error?: string;
}

export interface AndroidIntegrityOptions {
  /** SHA-256 digests of expected signing certificates (hex; colons/whitespace optional). */
  expectedSigningCertificates?: string[];
  /** Package names of allowed installers (e.g. `com.android.vending`). */
  allowedInstallers?: string[];
}

export interface IosIntegrityOptions {
  /** Expected Apple Team IDs (keychain access-group prefix). */
  expectedTeamIds?: string[];
  /** When true, require the main executable to be encrypted (App Store / TestFlight). */
  requireEncryptedBinary?: boolean;
}

export interface IntegrityPolicy {
  /**
   * Categories that make status `'compromised'`.
   * When omitted, defaults to every category except `'emulator'`.
   */
  compromisingCategories?: SignalCategory[];
}

export interface CheckIntegrityOptions {
  /**
   * Treat emulator/simulator signals as compromising. Default false (reported,
   * but status stays 'clean' unless the category is otherwise in the policy set).
   * Shorthand that unions `'emulator'` into the compromising category set.
   */
  treatEmulatorAsCompromised?: boolean;
  /** Resolve as 'unknown' with reason 'timeout' if native does not answer in time. Default 10000 ms. */
  timeoutMs?: number;
  /**
   * Signal ids to exclude from status resolution. Matching signals move to
   * `result.ignored` and never affect status.
   */
  ignore?: SignalId[];
  /**
   * Status policy. `compromisingCategories` replaces the default set when
   * provided; `treatEmulatorAsCompromised` is unioned in when both are set.
   */
  policy?: IntegrityPolicy;
  /** Android-only tamper options forwarded to native when provided. */
  android?: AndroidIntegrityOptions;
  /** iOS-only tamper options forwarded to native when provided. */
  ios?: IosIntegrityOptions;
}
