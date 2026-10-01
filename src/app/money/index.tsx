import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { CategoryPicker } from '../../modules/money/components/CategoryPicker';
import { Button, Card, colors, Field, Muted, Progress, styles, Title } from '../../shared/ui';
import {
  EXPENSE_CATEGORIES,
  EXPENSE_LABEL,
  insights,
  money,
  monthHistory,
  monthName,
  monthSummary,
  parseExpense,
} from '../../modules/money/lib/budget';
import { useStore } from '../../modules/money/lib/store';
import type { ExpenseCategory } from '../../modules/money/lib/types';

export default function Overview() {
  const { state, addExpense } = useStore();
  const { settings } = state;
  const c = settings.currency;
  const summary = useMemo(() => monthSummary(state.expenses, settings), [state.expenses, settings]);
  const tips = insights(summary, settings, state.rewards);
  const history = useMemo(() => monthHistory(state.expenses, 6), [state.expenses]);
  const max = Math.max(settings.monthlyBudget, ...history.map((h) => h.total), 1);

  const [text, setText] = useState('');
  const parsed = parseExpense(text);
  const [category, setCategory] = useState<ExpenseCategory | null>(null);
  const [saved, setSaved] = useState('');
  const chosen = category ?? parsed?.category ?? 'other';

  const spentCategories = EXPENSE_CATEGORIES.filter((cat) => summary.byCategory[cat] > 0 || settings.categoryBudgets[cat]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Card>
        <Muted>{monthName(summary.month)}</Muted>
        <Title>Spent {money(summary.total, c)}</Title>
        {settings.monthlyBudget > 0 ? (
          <Progress label="Monthly budget" value={summary.total} target={settings.monthlyBudget} unit={c.trim()} />
        ) : (
          <Muted>Set a monthly budget in the Budget tab to see how much you have left.</Muted>
        )}
        <Muted>
          {summary.remaining !== null
            ? summary.remaining >= 0
              ? `${money(summary.remaining, c)} left · ${summary.daysLeft} days to go`
              : `${money(-summary.remaining, c)} over budget`
            : `${summary.daysLeft} days to go`}
          {summary.averageMonth !== null ? ` · usual month ${money(summary.averageMonth, c)}` : ''}
        </Muted>
        {settings.weeklyGroceries > 0 && (
          <>
            <View style={{ height: 10 }} />
            <Progress
              label="Groceries & household this week"
              value={summary.groceriesThisWeek}
              target={settings.weeklyGroceries}
              unit={c.trim()}
              color={colors.water}
            />
          </>
        )}
      </Card>

      <Card>
        <Title>Quick add</Title>
        <Field
          label="What did you spend?"
          value={text}
          onChangeText={(t) => {
            setText(t);
            setCategory(null);
          }}
          placeholder="e.g. 12.50 lunch · Lidl 23,40 · €30 petrol"
          returnKeyType="done"
        />
        {parsed && (
          <>
            <Text style={[styles.text, { marginBottom: 8 }]}>
              {money(parsed.amount, c)}
              {parsed.note ? ` · ${parsed.note}` : ''}
            </Text>
            <CategoryPicker value={chosen} onChange={setCategory} />
            <View style={{ height: 10 }} />
          </>
        )}
        <Button
          label="Add expense"
          disabled={!parsed}
          onPress={() => {
            if (!parsed) return;
            addExpense({ amount: parsed.amount, note: parsed.note, category: chosen });
            setText('');
            setCategory(null);
            setSaved(`Added ${money(parsed.amount, c)} to ${EXPENSE_LABEL[chosen]}`);
            setTimeout(() => setSaved(''), 2500);
          }}
        />
        {!!saved && <Text style={{ color: colors.primary, marginTop: 8 }}>{saved}</Text>}
      </Card>

      {tips.length > 0 && (
        <Card>
          <Title>Insights</Title>
          {tips.map((t) => (
            <Text key={t} style={[styles.text, { marginBottom: 6 }]}>
              {t}
            </Text>
          ))}
        </Card>
      )}

      {spentCategories.length > 0 && (
        <Card>
          <Title>By category</Title>
          {spentCategories.map((cat) => {
            const limit = settings.categoryBudgets[cat];
            return limit ? (
              <Progress key={cat} label={EXPENSE_LABEL[cat]} value={summary.byCategory[cat]} target={limit} unit={c.trim()} />
            ) : (
              <View key={cat} style={styles.listItem}>
                <Text style={styles.text}>{EXPENSE_LABEL[cat]}</Text>
                <Text style={styles.text}>{money(summary.byCategory[cat], c)}</Text>
              </View>
            );
          })}
        </Card>
      )}

      <Card>
        <Title>Last 6 months</Title>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 110, gap: 8 }}>
          {history.map((h) => (
            <View key={h.month} style={{ flex: 1, height: 110, justifyContent: 'flex-end' }}>
              <View
                accessibilityLabel={`${monthName(h.month)}: ${money(h.total, c)}`}
                style={{
                  height: Math.max(h.total > 0 ? 2 : 0, (h.total / max) * 110),
                  backgroundColor: settings.monthlyBudget > 0 && h.total > settings.monthlyBudget ? colors.warn : colors.primary,
                  borderRadius: 4,
                }}
              />
            </View>
          ))}
          {settings.monthlyBudget > 0 && (
            <View
              pointerEvents="none"
              style={{ position: 'absolute', left: 0, right: 0, bottom: (settings.monthlyBudget / max) * 110, borderTopWidth: 1, borderStyle: 'dashed', borderColor: colors.muted }}
            />
          )}
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
          {history.map((h) => (
            <Text key={h.month} style={[styles.muted, { flex: 1, textAlign: 'center', fontSize: 11 }]}>
              {monthName(h.month).slice(0, 3)}
            </Text>
          ))}
        </View>
        {settings.monthlyBudget > 0 && <Muted>Dashed line = monthly budget</Muted>}
      </Card>
    </ScrollView>
  );
}
