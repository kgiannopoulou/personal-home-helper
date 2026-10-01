import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';

export const colors = {
  bg: '#F6F7F4',
  card: '#FFFFFF',
  text: '#1D2320',
  muted: '#6B746F',
  border: '#E3E6E1',
  primary: '#4F46E5',
  primarySoft: '#E8E7FC',
  water: '#2B7BB9',
  waterSoft: '#E1EEF8',
  warn: '#C0612B',
  warnSoft: '#FBEDE3',
  danger: '#B3261E',
};

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Title({ children }: { children: ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Muted({ children }: { children: ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'water' | 'danger';
  disabled?: boolean;
}) {
  const bg = {
    primary: colors.primary,
    secondary: colors.primarySoft,
    water: colors.water,
    danger: colors.danger,
  }[variant];
  const fg = variant === 'secondary' ? colors.primary : '#fff';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.button, { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 }]}
    >
      <Text style={[styles.buttonText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected && { backgroundColor: colors.primary, borderColor: colors.primary }]}
    >
      <Text style={[styles.chipText, selected && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

export function ChipRow<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.row}>
      {options.map((o) => (
        <Chip key={o.value} label={o.label} selected={o.value === value} onPress={() => onChange(o.value)} />
      ))}
    </View>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput placeholderTextColor={colors.muted} style={styles.input} {...props} />
    </View>
  );
}

export function Progress({
  label,
  value,
  target,
  unit,
  color = colors.primary,
}: {
  label: string;
  value: number;
  target: number;
  unit: string;
  color?: string;
}) {
  const pct = target > 0 ? Math.min(1, value / target) : 0;
  const over = value > target * 1.1;
  return (
    <View style={{ marginBottom: 10 }}>
      <View style={styles.progressHeader}>
        <Text style={styles.label}>{label}</Text>
        <Text style={[styles.muted, over && { color: colors.warn }]}>
          {Math.round(value)} / {Math.round(target)} {unit}
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: over ? colors.warn : color }]} />
      </View>
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 48, gap: 12 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 8 },
  muted: { fontSize: 14, color: colors.muted },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 4 },
  text: { fontSize: 15, color: colors.text },
  button: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, alignItems: 'center' },
  buttonText: { fontSize: 15, fontWeight: '700' },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipText: { fontSize: 14, color: colors.text },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
    backgroundColor: '#fff',
  },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  track: { height: 10, borderRadius: 5, backgroundColor: colors.border, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5 },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 8,
  },
});
