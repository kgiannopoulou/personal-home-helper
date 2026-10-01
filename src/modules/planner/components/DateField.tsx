import { View } from 'react-native';
import { fromDateKey, toDateKey } from '../../../shared/dates';
import { addDays } from '../lib/planner';
import { Chip, Field, styles } from '../../../shared/ui';

export const isDateKey = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(fromDateKey(v).getTime());

/** A YYYY-MM-DD field with quick chips. */
export function DateField({
  label,
  value,
  onChange,
  quick = [
    ['Today', 0],
    ['Tomorrow', 1],
    ['In a week', 7],
  ],
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  quick?: [string, number][];
}) {
  const today = toDateKey();
  return (
    <View>
      <Field label={label} value={value} onChangeText={onChange} placeholder="YYYY-MM-DD" autoCapitalize="none" />
      <View style={[styles.row, { marginTop: -4, marginBottom: 12 }]}>
        {quick.map(([l, days]) => {
          const key = addDays(today, days);
          return <Chip key={l} label={l} selected={value === key} onPress={() => onChange(key)} />;
        })}
      </View>
    </View>
  );
}
