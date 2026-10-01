import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Button, Card, ChipRow, colors, Field, Muted, styles, Title } from '../../shared/ui';
import { useStore } from '../../modules/shopping/lib/store';

export default function BudgetSettings() {
  const { state, setSettings } = useStore();
  const [weekly, setWeekly] = useState(String(state.settings.weeklyBudget || ''));
  const [monthly, setMonthly] = useState(String(state.settings.monthlyBudget || ''));
  const [currency, setCurrency] = useState(state.settings.currency);
  const [saved, setSaved] = useState('');

  useEffect(() => {
    setWeekly(String(state.settings.weeklyBudget || ''));
    setMonthly(String(state.settings.monthlyBudget || ''));
    setCurrency(state.settings.currency);
  }, [state.settings]);

  const num = (v: string) => (v.trim() === '' ? 0 : Number(v.replace(',', '.')));
  const valid = num(weekly) >= 0 && num(monthly) >= 0;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Card>
        <Title>Budget</Title>
        <Muted>Set how much you want to spend on shopping. Leave empty for no limit.</Muted>
        <View style={{ height: 12 }} />
        <Field label="Weekly food & household budget" value={weekly} onChangeText={setWeekly} keyboardType="decimal-pad" placeholder="e.g. 80" />
        <Field label="Monthly budget (optional)" value={monthly} onChangeText={setMonthly} keyboardType="decimal-pad" placeholder="e.g. 320" />
        <Text style={styles.label}>Currency</Text>
        <ChipRow
          value={currency}
          onChange={setCurrency}
          options={['€', '£', '$', 'kr ', 'CHF '].map((v) => ({ value: v, label: v.trim() }))}
        />
        <View style={{ height: 12 }} />
        <Button
          label="Save"
          disabled={!valid}
          onPress={() => {
            setSettings({ weeklyBudget: num(weekly), monthlyBudget: num(monthly), currency });
            setSaved('Saved ✓');
            setTimeout(() => setSaved(''), 2000);
          }}
        />
        {!!saved && <Text style={{ color: colors.primary, marginTop: 8 }}>{saved}</Text>}
      </Card>
      <Card>
        <Title>Connected apps</Title>
        <Muted>
          Kitchen Inventory can send items that run low, and spending from scanned receipts, straight into this list with
          one tap. Items sent from the kitchen show a 🏠.
        </Muted>
      </Card>
    </ScrollView>
  );
}
