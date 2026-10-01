import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { Button, Card, Muted, styles, Title } from '../../shared/ui';
import { EXPENSE_LABEL, money } from '../../modules/money/lib/budget';
import { parseMoneyImport, type MoneyImport } from '../../modules/money/lib/links';
import { useStore } from '../../modules/money/lib/store';

/** Handles moneybudget://add?spend=23.40&store=Lidl&date=… from the shopping and kitchen apps. */
export default function Import() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const { ready, addExpense, state } = useStore();
  const [result, setResult] = useState<MoneyImport | null>(null);
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    // Links can be delivered twice (e.g. on re-render), so import each one only once.
    const key = JSON.stringify(params);
    if (handled.current === key) return;
    handled.current = key;
    const data = parseMoneyImport(params);
    if (!data) {
      router.replace('/money');
      return;
    }
    addExpense({ amount: data.amount, note: data.store, category: data.category, date: data.date, source: 'shopping' });
    setResult(data);
  }, [ready, params, addExpense, router]);

  if (!result) return null;
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card>
        <Title>Expense added 🛒</Title>
        <Text style={styles.text}>
          {money(result.amount, state.settings.currency)}
          {result.store ? ` at ${result.store}` : ''} · {EXPENSE_LABEL[result.category]}
          {result.date ? ` · ${result.date}` : ''}
        </Text>
        <Muted> </Muted>
        <Button label="Open overview" onPress={() => router.replace('/money')} />
      </Card>
    </ScrollView>
  );
}
