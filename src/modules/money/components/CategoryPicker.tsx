import { View } from 'react-native';
import { EXPENSE_CATEGORIES, EXPENSE_LABEL } from '../lib/budget';
import type { ExpenseCategory } from '../lib/types';
import { Chip, styles } from '../../../shared/ui';

export function CategoryPicker({ value, onChange }: { value: ExpenseCategory; onChange: (c: ExpenseCategory) => void }) {
  return (
    <View style={styles.row}>
      {EXPENSE_CATEGORIES.map((c) => (
        <Chip key={c} label={EXPENSE_LABEL[c]} selected={c === value} onPress={() => onChange(c)} />
      ))}
    </View>
  );
}
