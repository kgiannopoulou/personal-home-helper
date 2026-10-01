import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { describeLevel } from '../modules/activity/lib/coach';
import { useStore as useActivity } from '../modules/activity/lib/store';
import { formatMinutes, planForTime } from '../modules/chores/lib/chores';
import { useStore as useChores } from '../modules/chores/lib/store';
import { useStore as useFood } from '../modules/food/lib/store';
import { useStore as useKitchen } from '../modules/kitchen/lib/store';
import { useStore as useShopping } from '../modules/shopping/lib/store';
import { toDateKey } from '../shared/dates';
import { Button, Card, Chip, ChipRow, colors, Field, Muted, Progress, styles, Title } from '../shared/ui';
import { useHub } from '../shared/useHub';

/** The things people run out of most (the same buttons as the watch app). */
const QUICK_ITEMS = ['Milk', 'Eggs', 'Bread', 'Coffee', 'Bananas', 'Yogurt', 'Dish soap', 'Toilet paper', 'Trash bags', 'Laundry detergent'];
const FREE = [5, 10, 15, 30].map((m) => ({ value: String(m), label: `${m} min` }));

/** Everything the watch companion does, connected to the real modules. */
export default function Quick() {
  const router = useRouter();
  const { food } = useHub();
  const { state: foodState, addWater, removeWater } = useFood();
  const { state: activityState } = useActivity();
  const { runCommand } = useKitchen();
  const { addItems } = useShopping();
  const { state: choresState, completeTask } = useChores();
  const [finished, setFinished] = useState<string[]>([]);
  const [custom, setCustom] = useState('');
  const [free, setFree] = useState('10');
  const today = toDateKey();
  const lastSip = [...foodState.water].reverse().find((w) => w.date === today);
  const mission = planForTime(choresState.tasks, Number(free));

  const finish = (name: string) => {
    const clean = name.trim();
    if (!clean) return;
    // Marks it empty in the kitchen and puts it straight on the shopping list.
    runCommand({ action: 'empty', names: [clean] });
    addItems([{ name: clean }], 'inventory');
    setFinished((f) => [...f, clean]);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Card>
        <Title>💧 Water</Title>
        <Progress label="Today" value={food.waterMl} target={food.waterGoal} unit="ml" color={colors.water} />
        <View style={styles.row}>
          {[150, 250, 500].map((ml) => (
            <View key={ml} style={{ flex: 1 }}>
              <Button label={`+${ml}`} variant="water" onPress={() => addWater(ml, 'water')} />
            </View>
          ))}
        </View>
        {lastSip && (
          <Text accessibilityRole="button" onPress={() => removeWater(lastSip.id)} style={{ color: colors.primary, marginTop: 8 }}>
            ↩ Undo {lastSip.ml} ml
          </Text>
        )}
      </Card>

      <Card>
        <Title>🛒 I finished…</Title>
        <Muted>Marks it empty in Kitchen and adds it to your Shopping list.</Muted>
        <View style={[styles.row, { marginTop: 8 }]}>
          {QUICK_ITEMS.filter((i) => !finished.includes(i)).map((i) => (
            <Chip key={i} label={i} onPress={() => finish(i)} />
          ))}
        </View>
        <View style={{ height: 8 }} />
        <View style={[styles.row, { alignItems: 'flex-end' }]}>
          <View style={{ flex: 1 }}>
            <Field label="Something else" value={custom} onChangeText={setCustom} placeholder="e.g. Olive oil" onSubmitEditing={() => {
                finish(custom);
                setCustom('');
              }}
            />
          </View>
          <View style={{ marginBottom: 12 }}>
            <Button
              label="Add"
              variant="secondary"
              disabled={!custom.trim()}
              onPress={() => {
                finish(custom);
                setCustom('');
              }}
            />
          </View>
        </View>
        {finished.length > 0 && <Text style={{ color: colors.primary }}>✓ On your list: {finished.join(', ')}</Text>}
      </Card>

      <Card>
        <Title>🏃 Run</Title>
        <Text style={styles.text}>
          Level {activityState.coach.level}: {describeLevel(activityState.coach.level)}
        </Text>
        <View style={{ height: 10 }} />
        <Button label="Open the run coach" onPress={() => router.push('/activity/coach')} />
      </Card>

      <Card>
        <Title>⚡ I have a few minutes</Title>
        <ChipRow options={FREE} value={free} onChange={setFree} />
        <View style={{ height: 8 }} />
        {mission.tasks.length === 0 && <Muted>Nothing that fits. You're on top of things!</Muted>}
        {mission.tasks.map((t) => (
          <View key={t.id} style={styles.listItem}>
            <Text style={[styles.text, { flex: 1 }]}>
              {t.name} · {formatMinutes(t.minutes)}
            </Text>
            <Text accessibilityRole="button" onPress={() => completeTask(t.id)} style={{ color: colors.primary, fontWeight: '700' }}>
              Done
            </Text>
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}
