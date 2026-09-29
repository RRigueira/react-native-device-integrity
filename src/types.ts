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

export interface Signal {
  id: string;
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
  platform: typeof Platform.OS;
  reason?: UnknownReason;
  error?: string;
}

export interface CheckIntegrityOptions {
  /** Treat emulator/simulator signals as compromising. Default false (reported, but status stays 'clean'). */
  treatEmulatorAsCompromised?: boolean;
  /** Resolve as 'unknown' with reason 'timeout' if native does not answer in time. Default 10000 ms. */
  timeoutMs?: number;
}
