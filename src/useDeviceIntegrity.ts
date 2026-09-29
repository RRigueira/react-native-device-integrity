import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { checkIntegrity } from './checkIntegrity';
import type {
  CheckIntegrityOptions,
  IntegrityResult,
  IntegrityStatus,
  Signal,
} from './types';

export type UseDeviceIntegrityResult = {
  status: IntegrityStatus;
  signals: Signal[];
  result: IntegrityResult | null;
  loading: boolean;
  refresh: () => Promise<IntegrityResult>;
};

/**
 * Stable serialization of options that affect the check. Inline object literals
 * with the same values must not retrigger the effect.
 */
function optionsKey(options: CheckIntegrityOptions): string {
  return JSON.stringify({
    treatEmulatorAsCompromised: options.treatEmulatorAsCompromised === true,
    timeoutMs: options.timeoutMs,
    ignore: options.ignore,
    policy: options.policy,
    android: options.android,
    ios: options.ios,
  });
}

export function useDeviceIntegrity(
  options: CheckIntegrityOptions = {}
): UseDeviceIntegrityResult {
  const key = optionsKey(options);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const [result, setResult] = useState<IntegrityResult | null>(null);
  const [loading, setLoading] = useState(true);

  const requestIdRef = useRef(0);
  const mountedRef = useRef(true);
  const appStateRef = useRef(AppState.currentState);

  const run = useCallback(async (): Promise<IntegrityResult> => {
    const requestId = ++requestIdRef.current;
    setLoading(true);

    const next = await checkIntegrity(optionsRef.current);

    if (mountedRef.current && requestId === requestIdRef.current) {
      setResult(next);
      setLoading(false);
    }

    return next;
    // `key` is the by-value options fingerprint (not used in the body; optionsRef is).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- equal-by-value options
  }, [key]);

  useEffect(() => {
    mountedRef.current = true;
    run().catch(() => {
      // checkIntegrity never rejects; guard against unexpected throws
    });

    return () => {
      mountedRef.current = false;
    };
  }, [run]);

  useEffect(() => {
    const onChange = (nextState: AppStateStatus) => {
      const previous = appStateRef.current;
      appStateRef.current = nextState;

      if (
        (previous === 'background' || previous === 'inactive') &&
        nextState === 'active'
      ) {
        run().catch(() => {
          // checkIntegrity never rejects; guard against unexpected throws
        });
      }
    };

    const subscription = AppState.addEventListener('change', onChange);
    return () => {
      subscription.remove();
    };
  }, [run]);

  const refresh = useCallback((): Promise<IntegrityResult> => {
    return run();
  }, [run]);

  return {
    status: result?.status ?? 'unknown',
    signals: result?.signals ?? [],
    result,
    loading,
    refresh,
  };
}
