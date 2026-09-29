import {
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { IntegrityGate } from '../components/IntegrityGate';

const TOP_INSET =
  Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 60;

type ProtectedScreenProps = {
  treatEmulatorAsCompromised: boolean;
  onBack: () => void;
};

export function ProtectedScreen({
  treatEmulatorAsCompromised,
  onBack,
}: ProtectedScreenProps) {
  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: false }}
        onPress={onBack}
        style={styles.backButton}
        testID="back-button"
      >
        <Text style={styles.backLabel}>Back</Text>
      </Pressable>

      <IntegrityGate options={{ treatEmulatorAsCompromised }}>
        <View style={styles.content}>
          <Text
            accessibilityRole="header"
            style={styles.heading}
            testID="protected-content"
          >
            Protected content
          </Text>
          <Text style={styles.body}>
            This device passed the integrity check.
          </Text>
        </View>
      </IntegrityGate>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    paddingTop: TOP_INSET,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginHorizontal: 24,
    marginBottom: 8,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  backLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2563EB',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    gap: 8,
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: '#374151',
  },
});
