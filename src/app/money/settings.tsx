import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { CategoryPicker } from '../../modules/money/components/CategoryPicker';
import { Button, Card, ChipRow, colors, Field, Muted, styles, Title } from '../../shared/ui';
import { EXPENSE_CATEGORIES, EXPENSE_LABEL, money } from '../../modules/money/lib/budget';
import { useStore } from '../../modules/money/lib/store';
import type { ExpenseCategory } from '../../modules/money/lib/types';

const num = (v: string) => (v.trim() === '' ? 0 : Number(v.replace(',', '.')));
const str = (n: number | undefined) => (n ? String(n) : '');

function BudgetCard() {
  const { state, setSettings } = useStore();
  const { settings } = state;
  const [monthly, setMonthly] = useState(str(settings.monthlyBudget));
  const [weekly, setWeekly] = useState(str(settings.weeklyGroceries));
  const [currency, setCurrency] = useState(settings.currency);
  const [cats, setCats] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState('');

  useEffect(() => {
    setMonthly(str(settings.monthlyBudget));
    setWeekly(str(settings.weeklyGroceries));
    setCurrency(settings.currency);
    setCats(Object.fromEntries(EXPENSE_CATEGORIES.map((c) => [c, str(settings.categoryBudgets[c])])));
  }, [settings]);

  const values = [monthly, weekly, ...Object.values(cats)].map(num);
  const valid = values.every((v) => Number.isFinite(v) && v >= 0);

  return (
    <Card>
      <Title>Budget</Title>
      <Muted>How much you want to spend. Leave empty for no limit.</Muted>
      <View style={{ height: 12 }} />
      <Field label="Monthly budget (everything)" value={monthly} onChangeText={setMonthly} keyboardType="decimal-pad" placeholder="e.g. 1200" />
      <Field label="Weekly groceries & household" value={weekly} onChangeText={setWeekly} keyboardType="decimal-pad" placeholder="e.g. 80" />
      <Text style={styles.label}>Monthly limit per category</Text>
      {EXPENSE_CATEGORIES.map((c) => (
        <View key={c} style={[styles.progressHeader, { alignItems: 'center', marginBottom: 6 }]}>
          <Text style={[styles.text, { flex: 1 }]}>{EXPENSE_LABEL[c]}</Text>
          <View style={{ width: 110 }}>
            <Field
              label=""
              value={cats[c] ?? ''}
              onChangeText={(v) => setCats({ ...cats, [c]: v })}
              keyboardType="decimal-pad"
              placeholder="no limit"
              accessibilityLabel={`${EXPENSE_LABEL[c]} limit`}
            />
          </View>
        </View>
      ))}
      <Text style={styles.label}>Currency</Text>
      <ChipRow value={currency} onChange={setCurrency} options={['€', '£', '$', 'kr ', 'CHF '].map((v) => ({ value: v, label: v.trim() }))} />
      <View style={{ height: 12 }} />
      <Button
        label="Save"
        disabled={!valid}
        onPress={() => {
          const categoryBudgets: Partial<Record<ExpenseCategory, number>> = {};
          for (const c of EXPENSE_CATEGORIES) if (num(cats[c] ?? '') > 0) categoryBudgets[c] = num(cats[c]);
          setSettings({ ...settings, monthlyBudget: num(monthly), weeklyGroceries: num(weekly), currency, categoryBudgets });
          setSaved('Saved ✓');
          setTimeout(() => setSaved(''), 2000);
        }}
      />
      {!!saved && <Text style={{ color: colors.primary, marginTop: 8 }}>{saved}</Text>}
    </Card>
  );
}

function RecurringCard() {
  const { state, addRecurring, removeRecurring } = useStore();
  const c = state.settings.currency;
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [day, setDay] = useState('1');
  const [category, setCategory] = useState<ExpenseCategory>('bills');
  const d = Number(day);

  return (
    <Card>
      <Title>Monthly bills 🔁</Title>
      <Muted>Rent, phone, subscriptions… They're added to your expenses automatically on their day each month.</Muted>
      <View style={{ height: 8 }} />
      {state.recurring.map((r) => (
        <View key={r.id} style={styles.listItem}>
          <View style={{ flex: 1 }}>
            <Text style={styles.text}>
              {r.name} · {money(r.amount, c)}
            </Text>
            <Muted>
              Day {r.dayOfMonth} · {EXPENSE_LABEL[r.category]}
            </Muted>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${r.name}`} onPress={() => removeRecurring(r.id)} hitSlop={8}>
            <Text style={{ color: colors.danger, fontSize: 18 }}>✕</Text>
          </Pressable>
        </View>
      ))}
      <View style={{ height: 8 }} />
      <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Netflix" />
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Field label={`Amount (${c.trim()})`} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Day of month (1–28)" value={day} onChangeText={setDay} keyboardType="number-pad" />
        </View>
      </View>
      <CategoryPicker value={category} onChange={setCategory} />
      <View style={{ height: 10 }} />
      <Button
        label="Add bill"
        variant="secondary"
        disabled={!name.trim() || !(num(amount) > 0) || !(Number.isInteger(d) && d >= 1 && d <= 28)}
        onPress={() => {
          addRecurring({ name: name.trim(), amount: Math.round(num(amount) * 100) / 100, dayOfMonth: d, category });
          setName('');
          setAmount('');
        }}
      />
    </Card>
  );
}

function RewardsCard() {
  const { state, addReward, removeReward } = useStore();
  const c = state.settings.currency;
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');

  return (
    <Card>
      <Title>Rewards 🎁</Title>
      <Muted>Things you'd like to treat yourself to. When you finish a month under budget, the app suggests one you can afford.</Muted>
      <View style={{ height: 8 }} />
      {state.rewards.map((r) => (
        <View key={r.id} style={styles.listItem}>
          <Text style={[styles.text, { flex: 1 }]}>
            {r.name} · {money(r.price, c)}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${r.name}`} onPress={() => removeReward(r.id)} hitSlop={8}>
            <Text style={{ color: colors.danger, fontSize: 18 }}>✕</Text>
          </Pressable>
        </View>
      ))}
      <View style={{ height: 8 }} />
      <View style={styles.row}>
        <View style={{ flex: 2 }}>
          <Field label="Reward" value={name} onChangeText={setName} placeholder="a new book" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label={`Price (${c.trim()})`} value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
        </View>
      </View>
      <Button
        label="Add reward"
        variant="secondary"
        disabled={!name.trim() || !(num(price) > 0)}
        onPress={() => {
          addReward({ name: name.trim(), price: num(price) });
          setName('');
          setPrice('');
        }}
      />
    </Card>
  );
}

export default function Settings() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <BudgetCard />
      <RecurringCard />
      <RewardsCard />
      <Card>
        <Title>Connected apps</Title>
        <Muted>
          Smart Shopping List and Kitchen Inventory can send shopping trips and scanned receipts here with
          moneybudget://add?spend=23.40&store=Lidl. They show up as 🛒 groceries.
        </Muted>
      </Card>
    </ScrollView>
  );
}
