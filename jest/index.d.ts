import type {
  CheckIntegrityOptions,
  IntegrityResult,
  IntegrityStatus,
  Signal,
  SignalId,
} from '../src/types';

export type {
  CheckIntegrityOptions,
  IntegrityResult,
  IntegrityStatus,
  Signal,
  SignalId,
};

export declare const SIGNAL_IDS: readonly SignalId[];

export type UseDeviceIntegrityResult = {
  status: IntegrityStatus;
  signals: Signal[];
  result: IntegrityResult;
  loading: false;
  refresh: () => Promise<IntegrityResult>;
};

export declare function checkIntegrity(
  options?: CheckIntegrityOptions
): Promise<IntegrityResult>;

export declare function useDeviceIntegrity(
  options?: CheckIntegrityOptions
): UseDeviceIntegrityResult;

export declare function setMockIntegrityResult(
  partial: Partial<IntegrityResult>
): void;

export declare function resetMockIntegrity(): void;
