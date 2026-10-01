import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { Button, Card, Muted, styles, Title } from '../../shared/ui';
import { parseShoppingImport } from '../../shared/homeCore';
import { money } from '../../modules/shopping/lib/shopping';
import { useStore as useMoney } from '../../modules/money/lib/store';
import { useStore } from '../../modules/shopping/lib/store';

/**
 * Imports items and receipt spending from the Kitchen and Chores modules
 * (/shopping/add?items=Milk|Eggs&spend=23.40&store=Lidl). Spending is also logged in Money.
 */
export default function Import() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const { ready, importData, state } = useStore();
  const { addExpense } = useMoney();
  const [result, setResult] = useState<{ items: string[]; added: number; spend?: number; store?: string } | null>(null);
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    // Links can be delivered twice (e.g. on re-render), so import each one only once.
    const key = JSON.stringify(params);
    if (handled.current === key) return;
    handled.current = key;
    const data = parseShoppingImport(params);
    if (!data.items.length && data.spend === undefined) {
      router.replace('/shopping');
      return;
    }
    const { added, spend } = importData(data);
    if (spend !== undefined) addExpense({ amount: spend, note: data.store, category: 'groceries', date: data.date, source: 'shopping' });
    setResult({ items: data.items, added, spend, store: data.store });
  }, [ready, params, importData, addExpense, router]);

  if (!result) return null;
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card>
        <Title>From your kitchen 🏠</Title>
        {result.items.length > 0 && (
          <Text style={styles.text}>
            {result.added > 0 ? `Added ${result.added} item(s)` : 'Already on your list'}: {result.items.join(', ')}
          </Text>
        )}
        {result.spend !== undefined && (
          <Text style={[styles.text, { marginTop: 6 }]}>
            Logged {money(result.spend, state.settings.currency)} spent{result.store ? ` at ${result.store}` : ''}, in Shopping and Money.
          </Text>
        )}
        <Muted> </Muted>
        <Button label="Open shopping list" onPress={() => router.replace('/shopping')} />
      </Card>
    </ScrollView>
  );
}
