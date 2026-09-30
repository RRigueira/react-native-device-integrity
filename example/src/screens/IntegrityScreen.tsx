import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import {
  useDeviceIntegrity,
  type CheckIntegrityOptions,
  type IntegrityStatus,
  type Signal,
} from 'react-native-device-integrity';

const TOP_INSET =
  Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 60;

const STATUS_COLORS: Record<
  IntegrityStatus,
  { background: string; text: string }
> = {
  clean: { background: '#D1FAE5', text: '#065F46' },
  compromised: { background: '#FEE2E2', text: '#991B1B' },
  unknown: { background: '#FEF3C7', text: '#92400E' },
};

/** Demo-only fake cert (64 hex zeros) so emulators report signature mismatch. */
const TAMPER_DEMO_CERT = '00'.repeat(32);

type IntegrityScreenProps = {
  treatEmulatorAsCompromised: boolean;
  onTreatEmulatorChange: (value: boolean) => void;
  androidTamperDemo: boolean;
  onAndroidTamperDemoChange: (value: boolean) => void;
  onOpenProtected: () => void;
};

export function buildCheckOptions(params: {
  treatEmulatorAsCompromised: boolean;
  androidTamperDemo: boolean;
}): CheckIntegrityOptions {
  const options: CheckIntegrityOptions = {
    treatEmulatorAsCompromised: params.treatEmulatorAsCompromised,
  };

  if (params.androidTamperDemo) {
    options.android = {
      expectedSigningCertificates: [TAMPER_DEMO_CERT],
      allowedInstallers: ['com.android.vending'],
    };
  }

  return options;
}

export function IntegrityScreen({
  treatEmulatorAsCompromised,
  onTreatEmulatorChange,
  androidTamperDemo,
  onAndroidTamperDemoChange,
  onOpenProtected,
}: IntegrityScreenProps) {
  const { status, signals, result, loading, refresh } = useDeviceIntegrity(
    buildCheckOptions({ treatEmulatorAsCompromised, androidTamperDemo })
  );

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      style={styles.scroll}
      testID="integrity-screen"
    >
      <Text style={styles.title}>Device Integrity</Text>

      <StatusBadge status={status} />

      <Text style={styles.platform}>Platform: {Platform.OS}</Text>

      {result != null ? (
        <Text style={styles.meta} testID="duration-label">
          Duration: {Math.round(result.durationMs)} ms · Ignored:{' '}
          {result.ignored.length}
        </Text>
      ) : null}

      {status === 'unknown' && result?.reason != null ? (
        <Text style={styles.meta}>Reason: {result.reason}</Text>
      ) : null}
      {status === 'unknown' && result?.error != null ? (
        <Text style={styles.meta}>Error: {result.error}</Text>
      ) : null}

      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color="#111827" />
          <Text style={styles.loadingLabel}>Checking…</Text>
        </View>
      ) : null}

      <SignalsList signals={signals} />

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel} accessibilityRole="text">
          Treat emulator as compromised
        </Text>
        <Switch
          accessibilityLabel="Treat emulator as compromised"
          onValueChange={onTreatEmulatorChange}
          testID="emulator-switch"
          value={treatEmulatorAsCompromised}
        />
      </View>

      {Platform.OS === 'android' ? (
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel} accessibilityRole="text">
            Android tamper demo
          </Text>
          <Switch
            accessibilityLabel="Android tamper demo"
            onValueChange={onAndroidTamperDemoChange}
            testID="tamper-demo-switch"
            value={androidTamperDemo}
          />
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: loading }}
        disabled={loading}
        onPress={() => {
          refresh().catch(() => {
            // refresh never rejects in practice
          });
        }}
        style={[styles.button, loading && styles.buttonDisabled]}
        testID="recheck-button"
      >
        <Text style={styles.buttonLabel}>Re-check</Text>
        {loading ? <ActivityIndicator size="small" color="#fff" /> : null}
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: false }}
        onPress={onOpenProtected}
        style={styles.buttonSecondary}
        testID="open-protected-button"
      >
        <Text style={styles.buttonSecondaryLabel}>Open protected screen</Text>
      </Pressable>

      <Text style={styles.footnote}>
        unknown is never treated as clean — this demo fails closed.
      </Text>
    </ScrollView>
  );
}

function StatusBadge({ status }: { status: IntegrityStatus }) {
  const colors = STATUS_COLORS[status];

  return (
    <View
      accessibilityLabel={`Status: ${status}`}
      accessibilityRole="text"
      style={[styles.badge, { backgroundColor: colors.background }]}
      testID="status-badge"
    >
      <Text style={[styles.badgeText, { color: colors.text }]}>
        {status.toUpperCase()}
      </Text>
    </View>
  );
}

function SignalsList({ signals }: { signals: Signal[] }) {
  return (
    <View style={styles.signals} testID="signals-list">
      <Text style={styles.sectionTitle}>Signals ({signals.length})</Text>
      {signals.length === 0 ? (
        <Text style={styles.empty}>No signals detected</Text>
      ) : (
        signals.map((signal, index) => (
          <View key={`${signal.id}-${index}`} style={styles.signalRow}>
            <View style={styles.chip}>
              <Text style={styles.chipText}>{signal.category}</Text>
            </View>
            <View style={styles.signalBody}>
              <Text style={styles.signalId}>{signal.id}</Text>
              <Text style={styles.signalDescription}>{signal.description}</Text>
            </View>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    paddingTop: TOP_INSET,
    paddingHorizontal: 24,
    paddingBottom: 40,
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  platform: {
    fontSize: 14,
    color: '#374151',
  },
  meta: {
    fontSize: 13,
    color: '#6B7280',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingLabel: {
    fontSize: 13,
    color: '#6B7280',
  },
  signals: {
    gap: 8,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  empty: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  signalRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  chip: {
    backgroundColor: '#E5E7EB',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#374151',
    textTransform: 'uppercase',
  },
  signalBody: {
    flex: 1,
    gap: 2,
  },
  signalId: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  signalDescription: {
    fontSize: 13,
    color: '#6B7280',
  },
  switchRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  switchLabel: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
  },
  button: {
    marginTop: 4,
    alignSelf: 'stretch',
    backgroundColor: '#111827',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
  buttonSecondary: {
    alignSelf: 'stretch',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonSecondaryLabel: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '600',
  },
  footnote: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 18,
    color: '#9CA3AF',
  },
});
