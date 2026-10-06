import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Signal } from 'react-native-device-integrity';

import { SIGNAL_INFO, type SignalStrength } from '../signalInfo';

const STRENGTH: Record<
  SignalStrength,
  { label: string; background: string; text: string }
> = {
  strong: { label: 'Strong', background: '#FEE2E2', text: '#991B1B' },
  medium: { label: 'Medium', background: '#FEF3C7', text: '#92400E' },
  context: { label: 'Context', background: '#E0E7FF', text: '#3730A3' },
};

type SignalRowProps = {
  signal: Signal;
  /** Ignored signals render dimmed and say so. */
  ignored?: boolean;
  /** Draws a hairline above the row; the list sets it on every row but the first. */
  divider?: boolean;
};

/**
 * One signal: category, id and the library's description, plus the example's
 * own explanation (strength, when it's expected, and — on tap — what the
 * native check inspects, what it means, how it's bypassed).
 */
export function SignalRow({
  signal,
  ignored = false,
  divider = false,
}: SignalRowProps) {
  const [open, setOpen] = useState(false);
  const info = SIGNAL_INFO[signal.id as keyof typeof SIGNAL_INFO];
  const details =
    info?.platforms[Platform.OS === 'ios' ? 'ios' : 'android'] ??
    info?.platforms.ios ??
    info?.platforms.android;
  const strength = info ? STRENGTH[info.strength] : null;

  return (
    <Pressable
      accessibilityHint={details ? 'Shows how this check works' : undefined}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      disabled={!details}
      onPress={() => setOpen((value) => !value)}
      style={[styles.row, divider && styles.divider, ignored && styles.ignored]}
      testID={`signal-${signal.id}`}
    >
      <View style={styles.header}>
        {/* Category and strength stack in a fixed column, so every row lines
            up the same way however long the signal id is. */}
        <View style={styles.chipColumn}>
          <View style={styles.chip}>
            <Text style={styles.chipText}>{signal.category}</Text>
          </View>
          {strength ? (
            <View
              style={[styles.pill, { backgroundColor: strength.background }]}
            >
              <Text style={[styles.pillText, { color: strength.text }]}>
                {strength.label}
              </Text>
            </View>
          ) : null}
          {ignored ? (
            <View style={[styles.pill, styles.ignoredPill]}>
              <Text style={[styles.pillText, styles.ignoredPillText]}>
                Ignored
              </Text>
            </View>
          ) : null}
        </View>
        <View style={styles.body}>
          <Text style={styles.id}>{signal.id}</Text>
          <Text style={styles.description}>{signal.description}</Text>
          {info?.expected ? (
            <Text style={styles.expected}>{info.expected}</Text>
          ) : null}
          {details ? (
            <Text style={styles.toggle}>
              {open ? 'Hide details ▴' : 'How it works ▾'}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Full row width: the explanation is long and reads badly squeezed
          beside the chip column. */}
      {details && open ? (
        <View style={styles.details} testID={`signal-details-${signal.id}`}>
          <Text style={styles.detailsTitle}>{details.title}</Text>
          <Detail label="What it checks" text={details.checks} />
          <Detail label="What it means" text={details.threat} />
          <Detail label="How it's bypassed" text={details.bypass} />
          {details.mastg.length > 0 ? (
            <Detail label="OWASP MASTG" text={details.mastg.join(', ')} />
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}

function Detail({ label, text }: { label: string; text: string }) {
  return (
    <View style={styles.detail}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: 10,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
  },
  header: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  ignored: {
    opacity: 0.6,
  },
  // Fixed width so every signal's text starts at the same x, whatever the
  // category ("environment" is the widest label).
  chipColumn: {
    width: 104,
    alignItems: 'flex-start',
    gap: 6,
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
  body: {
    flex: 1,
    gap: 2,
  },
  id: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  pill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  pillText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  ignoredPill: {
    backgroundColor: '#E5E7EB',
  },
  ignoredPillText: {
    color: '#4B5563',
  },
  description: {
    fontSize: 13,
    color: '#6B7280',
  },
  expected: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 17,
    color: '#3730A3',
  },
  toggle: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '600',
    color: '#2563EB',
  },
  details: {
    marginTop: 12,
    gap: 10,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    padding: 12,
  },
  detailsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  detail: {
    gap: 2,
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  detailText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#374151',
  },
});
