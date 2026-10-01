import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Button, Card, colors, Field, Muted, styles, Title } from '../../shared/ui';
import { fromDateKey } from '../../shared/dates';
import { money, spendingInsights, spendSummary } from '../../modules/shopping/lib/shopping';
import { useStore } from '../../modules/shopping/lib/store';

export default function Spending() {
  const { state, removeTrip, addTrip } = useStore();
  const c = state.settings.currency;
  const summary = useMemo(() => spendSummary(state.trips), [state.trips]);
  const insights = spendingInsights(summary, state.settings);
  const max = Math.max(state.settings.weeklyBudget, ...summary.weeks.map((w) => w.total), 1);
  const trips = [...state.trips].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 15);
  const [amount, setAmount] = useState('');
  const [store, setStore] = useState('');
  const a = Number(amount.replace(',', '.'));

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Card>
        <Title>This week: {money(summary.thisWeek, c)}</Title>
        <Muted>
          Last week {money(summary.lastWeek, c)} · this month {money(summary.thisMonth, c)}
          {summary.averageWeek !== null ? ` · 4-week average ${money(summary.averageWeek, c)}` : ''}
        </Muted>
        <View style={{ height: 12 }} />
        {insights.map((i) => (
          <Text key={i} style={[styles.text, { marginBottom: 6 }]}>
            {i}
          </Text>
        ))}
      </Card>

      <Card>
        <Title>Last 8 weeks</Title>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 110, gap: 6 }}>
          {summary.weeks.map((w) => (
            <View key={w.start} style={{ flex: 1, height: 110, justifyContent: 'flex-end' }}>
              <View
                accessibilityLabel={`Week of ${w.start}: ${money(w.total, c)}`}
                style={{
                  height: Math.max(w.total > 0 ? 2 : 0, (w.total / max) * 110),
                  backgroundColor: state.settings.weeklyBudget > 0 && w.total > state.settings.weeklyBudget ? colors.warn : colors.primary,
                  borderRadius: 4,
                }}
              />
            </View>
          ))}
          {state.settings.weeklyBudget > 0 && (
            <View
              pointerEvents="none"
              style={{ position: 'absolute', left: 0, right: 0, bottom: (state.settings.weeklyBudget / max) * 110, borderTopWidth: 1, borderStyle: 'dashed', borderColor: colors.muted }}
            />
          )}
        </View>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
          {summary.weeks.map((w) => (
            <Text key={w.start} style={[styles.muted, { flex: 1, textAlign: 'center', fontSize: 11 }]}>
              {fromDateKey(w.start).getDate()}/{fromDateKey(w.start).getMonth() + 1}
            </Text>
          ))}
        </View>
        <Muted>Dashed line = weekly budget</Muted>
      </Card>

      <Card>
        <Title>Log a purchase</Title>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Field label={`Amount (${c})`} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Store" value={store} onChangeText={setStore} placeholder="optional" />
          </View>
        </View>
        <Button
          label="Save"
          disabled={!(a > 0)}
          onPress={() => {
            addTrip(Math.round(a * 100) / 100, store.trim() || undefined);
            setAmount('');
            setStore('');
          }}
        />
      </Card>

      <Card>
        <Title>Recent trips</Title>
        {trips.length === 0 && <Muted>Finish a shopping trip or scan a receipt in Kitchen Inventory to see your spending.</Muted>}
        {trips.map((t) => (
          <View key={t.id} style={styles.listItem}>
            <View style={{ flex: 1 }}>
              <Text style={styles.text}>
                {t.store ?? 'Shopping'} · {money(t.total, c)}
              </Text>
              <Muted>
                {t.date}
                {t.itemCount ? ` · ${t.itemCount} items` : ''}
                {t.source === 'receipt' ? ' · 🧾 receipt' : ''}
              </Muted>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Delete trip" onPress={() => removeTrip(t.id)} hitSlop={8}>
              <Text style={{ color: colors.danger, fontSize: 18 }}>✕</Text>
            </Pressable>
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}
