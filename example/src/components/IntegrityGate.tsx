import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import {
  useDeviceIntegrity,
  type CheckIntegrityOptions,
  type IntegrityResult,
} from 'react-native-device-integrity';
import { BlockedView } from './BlockedView';

type IntegrityGateProps = {
  children: ReactNode;
  options?: CheckIntegrityOptions;
  fallback?: (result: IntegrityResult) => ReactNode;
};

/**
 * Fail-closed gate: only render children when status === 'clean'.
 * 'unknown' is treated like a block — a failed or incomplete check must never
 * be mistaken for a safe device.
 */
export function IntegrityGate({
  children,
  options,
  fallback,
}: IntegrityGateProps) {
  const { status, signals, result, loading, refresh } =
    useDeviceIntegrity(options);

  // First check still in flight — do not flash a blocked state prematurely.
  if (loading && result == null) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#111827" />
        <Text style={styles.loadingLabel}>Checking device integrity…</Text>
      </View>
    );
  }

  if (status === 'clean') {
    return <>{children}</>;
  }

  if (fallback != null && result != null) {
    return <>{fallback(result)}</>;
  }

  return (
    <BlockedView
      status={status}
      signals={signals}
      reason={result?.reason}
      error={result?.error}
      loading={loading}
      onRetry={() => {
        refresh().catch(() => {
          // refresh never rejects in practice
        });
      }}
    />
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
  },
  loadingLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
});
