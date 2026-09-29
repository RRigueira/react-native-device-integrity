import { Text, View, StyleSheet } from 'react-native';
import { useDeviceIntegrity } from 'react-native-device-integrity';

export default function App() {
  const { status, result, signals, loading } = useDeviceIntegrity();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Device Integrity</Text>
      <Text>Status: {status}</Text>
      <Text>Loading: {loading ? 'yes' : 'no'}</Text>
      {result?.reason != null ? <Text>Reason: {result.reason}</Text> : null}
      <Text style={styles.section}>Signals ({signals.length})</Text>
      {signals.map((signal, index) => (
        <Text key={`${signal.id}-${index}`}>
          [{signal.category}] {signal.id}: {signal.description}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: 24,
    gap: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  section: {
    marginTop: 12,
    fontWeight: '600',
  },
});
