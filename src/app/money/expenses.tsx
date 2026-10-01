import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { CategoryPicker } from '../../modules/money/components/CategoryPicker';
import { Button, Card, colors, Field, Muted, styles, Title } from '../../shared/ui';
import { EXPENSE_LABEL, inMonth, money, monthKey, monthName, shiftMonth, sum } from '../../modules/money/lib/budget';
import { fromDateKey, toDateKey } from '../../shared/dates';
import { useStore } from '../../modules/money/lib/store';
import type { ExpenseCategory } from '../../modules/money/lib/types';

export default function Expenses() {
  const { state, addExpense, removeExpense } = useStore();
  const c = state.settings.currency;
  const [month, setMonth] = useState(monthKey());
  const list = useMemo(
    () => inMonth(state.expenses, month).sort((a, b) => b.date.localeCompare(a.date)),
    [state.expenses, month],
  );
  const days = useMemo(() => {
    const groups = new Map<string, typeof list>();
    for (const e of list) groups.set(e.date, [...(groups.get(e.date) ?? []), e]);
    return [...groups.entries()];
  }, [list]);

  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(toDateKey());
  const [category, setCategory] = useState<ExpenseCategory>('groceries');
  const a = Number(amount.replace(',', '.'));
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(fromDateKey(date).getTime());

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Card>
        <Title>Add an expense</Title>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Field label={`Amount (${c.trim()})`} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Date" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />
          </View>
        </View>
        <Field label="Note" value={note} onChangeText={setNote} placeholder="optional, e.g. Lidl" />
        <CategoryPicker value={category} onChange={setCategory} />
        <View style={{ height: 12 }} />
        <Button
          label="Save"
          disabled={!(a > 0) || !validDate}
          onPress={() => {
            addExpense({ amount: Math.round(a * 100) / 100, note: note.trim() || undefined, category, date });
            setAmount('');
            setNote('');
          }}
        />
      </Card>

      <Card>
        <View style={[styles.progressHeader, { alignItems: 'center', marginBottom: 8 }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Previous month" onPress={() => setMonth(shiftMonth(month, -1))} hitSlop={10}>
            <Text style={{ fontSize: 20, color: colors.primary }}>‹</Text>
          </Pressable>
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.label}>{monthName(month)}</Text>
            <Muted>{money(sum(list), c)}</Muted>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next month"
            disabled={month >= monthKey()}
            onPress={() => setMonth(shiftMonth(month, 1))}
            hitSlop={10}
          >
            <Text style={{ fontSize: 20, color: month >= monthKey() ? colors.border : colors.primary }}>›</Text>
          </Pressable>
        </View>
        {list.length === 0 && <Muted>No expenses this month.</Muted>}
        {days.map(([day, items]) => (
          <View key={day} style={{ marginTop: 8 }}>
            <Muted>
              {fromDateKey(day).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })} ·{' '}
              {money(sum(items), c)}
            </Muted>
            {items.map((e) => (
              <View key={e.id} style={styles.listItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.text}>
                    {e.note ?? EXPENSE_LABEL[e.category].replace(/^\S+\s/, '')} · {money(e.amount, c)}
                  </Text>
                  <Muted>
                    {EXPENSE_LABEL[e.category]}
                    {e.source === 'recurring' ? ' · 🔁 monthly' : e.source === 'shopping' ? ' · 🛒 from shopping' : ''}
                  </Muted>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel="Delete expense" onPress={() => removeExpense(e.id)} hitSlop={8}>
                  <Text style={{ color: colors.danger, fontSize: 18 }}>✕</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}
