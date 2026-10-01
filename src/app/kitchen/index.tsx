import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Button, Card, colors, Muted, styles, Title } from '../../shared/ui';
import { toDateKey } from '../../shared/dates';
import { normalizeName } from '../../shared/homeCore';
import { buyReason, expiryStatus, parseCommand, predictRunOut } from '../../modules/kitchen/lib/inventory';
import { suggestRecipes } from '../../modules/kitchen/lib/recipes';
import { sendToShopping } from '../../modules/kitchen/lib/sendToShopping';
import { useStore } from '../../modules/kitchen/lib/store';

function expiryLabel(daysLeft: number): string {
  if (daysLeft < 0) return `expired ${-daysLeft} day${daysLeft === -1 ? '' : 's'} ago`;
  if (daysLeft === 0) return 'use today';
  if (daysLeft === 1) return 'use by tomorrow';
  return `use within ${daysLeft} days`;
}

export default function Kitchen() {
  const { state, ready, runCommand, addToBuy, removeToBuy, clearToBuy } = useStore();
  const [text, setText] = useState('');
  const [feedback, setFeedback] = useState('');
  const [sent, setSent] = useState('');
  const today = toDateKey();

  const view = useMemo(() => {
    const useSoon = state.items
      .map((item) => ({ item, exp: expiryStatus(item, today) }))
      .filter((x) => x.exp && x.exp.status !== 'ok')
      .sort((a, b) => a.exp!.daysLeft - b.exp!.daysLeft);
    const inList = (name: string) => state.toBuy.some((n) => normalizeName(n) === normalizeName(name));
    const runningLow = state.items.filter((i) => (i.level === 'low' || i.level === 'empty') && !inList(i.name));
    const predicted = state.items
      .map((item) => ({ item, p: predictRunOut(item, today) }))
      .filter((x) => x.p && x.p.daysLeft <= 2 && buyReason(x.item, today) === 'predicted' && !inList(x.item.name));
    return { useSoon, runningLow, predicted, recipes: suggestRecipes(state.items, today) };
  }, [state.items, state.toBuy, today]);

  if (!ready) return null;

  const submit = () => {
    const cmd = parseCommand(text);
    if (!cmd) {
      setFeedback('Try: "I finished the milk", "out of eggs and bread", "dish soap is low" or "bought spinach".');
      return;
    }
    setFeedback(runCommand(cmd));
    setText('');
  };

  const send = async () => {
    const how = await sendToShopping({ items: state.toBuy });
    setSent(how === 'app' ? 'Sent to Smart Shopping List ✓' : 'Shared ✓');
    if (how === 'app') clearToBuy();
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Card>
        <Title>What happened in the kitchen?</Title>
        <View style={[styles.row, { alignItems: 'center' }]}>
          <TextInput
            value={text}
            onChangeText={setText}
            onSubmitEditing={submit}
            placeholder='e.g. "I finished the dish soap"'
            placeholderTextColor={colors.muted}
            returnKeyType="done"
            style={[styles.input, { flex: 1 }]}
          />
          <Button label="OK" onPress={submit} disabled={!text.trim()} />
        </View>
        {!!feedback && <Text style={[styles.muted, { marginTop: 8 }]}>{feedback}</Text>}
      </Card>

      {view.useSoon.length > 0 && (
        <Card style={{ borderColor: colors.warn }}>
          <Title>⚠️ Use soon</Title>
          {view.useSoon.map(({ item, exp }) => (
            <View key={item.id} style={styles.listItem}>
              <Text style={styles.text}>{item.name}</Text>
              <Text style={{ color: exp!.status === 'expired' ? colors.danger : colors.warn }}>{expiryLabel(exp!.daysLeft)}</Text>
            </View>
          ))}
          {view.recipes.length > 0 && (
            <View style={{ marginTop: 10, padding: 12, borderRadius: 12, backgroundColor: colors.primarySoft }}>
              <Text style={[styles.label, { marginBottom: 6 }]}>Tonight's suggestion</Text>
              {view.recipes.map((r) => (
                <View key={r.recipe.name} style={{ marginBottom: 6 }}>
                  <Text style={styles.text}>
                    {r.recipe.emoji} {r.recipe.name} · {r.recipe.minutes} min
                  </Text>
                  <Muted>
                    Uses {r.usesSoon.join(', ')}
                    {r.missing.length ? ` · you'd need: ${r.missing.join(', ')}` : ' · you have everything'}
                  </Muted>
                </View>
              ))}
            </View>
          )}
        </Card>
      )}

      {(view.runningLow.length > 0 || view.predicted.length > 0) && (
        <Card>
          <Title>Running out</Title>
          {view.runningLow.map((i) => (
            <View key={i.id} style={styles.listItem}>
              <Text style={styles.text}>
                {i.level === 'empty' ? '🔴' : '🟡'} {i.name}
              </Text>
              <Button variant="secondary" label="+ List" onPress={() => addToBuy(i.name)} />
            </View>
          ))}
          {view.predicted.map(({ item, p }) => (
            <View key={item.id} style={styles.listItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.text}>🔮 {item.name} may run out soon</Text>
                <Muted>You usually buy it every {p!.everyDays} days</Muted>
              </View>
              <Button variant="secondary" label="+ List" onPress={() => addToBuy(item.name)} />
            </View>
          ))}
        </Card>
      )}

      <Card>
        <Title>🛒 To buy ({state.toBuy.length})</Title>
        {state.toBuy.length === 0 && <Muted>Nothing yet. Items you mark as low or finished land here.</Muted>}
        {state.toBuy.map((name) => (
          <View key={name} style={styles.listItem}>
            <Text style={styles.text}>{name}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${name}`} onPress={() => removeToBuy(name)} hitSlop={8}>
              <Text style={{ color: colors.danger, fontSize: 18 }}>✕</Text>
            </Pressable>
          </View>
        ))}
        {state.toBuy.length > 0 && (
          <View style={{ marginTop: 12 }}>
            <Button label="Send to Smart Shopping List" onPress={send} />
          </View>
        )}
        {!!sent && <Muted>{sent}</Muted>}
      </Card>

      {state.items.length === 0 && (
        <Card>
          <Title>Get started</Title>
          <Muted>Scan a supermarket receipt or add items in the Inventory tab. The app then tracks what you have, what expires, and what to buy.</Muted>
        </Card>
      )}
    </ScrollView>
  );
}
