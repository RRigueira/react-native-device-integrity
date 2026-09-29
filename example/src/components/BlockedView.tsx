import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type {
  IntegrityStatus,
  Signal,
  UnknownReason,
} from 'react-native-device-integrity';

type BlockedViewProps = {
  status: IntegrityStatus;
  signals: Signal[];
  reason?: UnknownReason;
  error?: string;
  loading?: boolean;
  onRetry: () => void;
};

export function BlockedView({
  status,
  signals,
  reason,
  error,
  loading = false,
  onRetry,
}: BlockedViewProps) {
  const explanation =
    status === 'compromised'
      ? 'This device reported integrity signals that indicate it may be compromised. Access is blocked.'
      : 'The integrity check could not confirm this device is safe. Access is blocked until the check succeeds.';

  return (
    <View style={styles.container}>
      <Text
        accessibilityRole="header"
        style={styles.heading}
        testID="blocked-view"
      >
        Access blocked
      </Text>
      <Text style={styles.explanation}>{explanation}</Text>

      {signals.length > 0 ? (
        <View style={styles.list}>
          <Text style={styles.listTitle}>Signals</Text>
          {signals.map((signal, index) => (
            <Text key={`${signal.id}-${index}`} style={styles.listItem}>
              {signal.id}
            </Text>
          ))}
        </View>
      ) : null}

      {reason != null ? (
        <Text style={styles.meta}>Reason: {reason}</Text>
      ) : null}
      {error != null ? <Text style={styles.meta}>Error: {error}</Text> : null}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: loading }}
        disabled={loading}
        onPress={onRetry}
        style={[styles.button, loading && styles.buttonDisabled]}
        testID="try-again-button"
      >
        <Text style={styles.buttonLabel}>Try again</Text>
        {loading ? <ActivityIndicator size="small" color="#fff" /> : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 12,
    justifyContent: 'center',
    padding: 24,
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  explanation: {
    fontSize: 15,
    lineHeight: 22,
    color: '#374151',
  },
  list: {
    gap: 4,
    marginTop: 4,
  },
  listTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  listItem: {
    fontSize: 14,
    color: '#4B5563',
    fontFamily: 'Courier',
  },
  meta: {
    fontSize: 13,
    color: '#6B7280',
  },
  button: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#111827',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonLabel: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
