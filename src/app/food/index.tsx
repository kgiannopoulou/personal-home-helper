import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Button, Card, colors, Muted, Progress, styles, Title } from '../../shared/ui';
import { toDateKey } from '../../shared/dates';
import { dailyTargets, daySummary, suggestNextMeal, weekSummary } from '../../modules/food/lib/nutrition';
import { useStore } from '../../modules/food/lib/store';
import type { Meal } from '../../modules/food/lib/types';

const MEALS: Meal[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export default function Today() {
  const { state, ready, addWater, removeFood, removeWater } = useStore();
  const router = useRouter();
  const [customMl, setCustomMl] = useState('');
  const today = toDateKey();

  const data = useMemo(() => {
    if (!state.profile) return null;
    const targets = dailyTargets(state.profile);
    const day = daySummary(today, state.foods, state.water);
    const week = weekSummary(state.foods, state.water, targets);
    const advice = suggestNextMeal(day.nutrients, targets, week, state.profile.diet);
    return { targets, day, advice };
  }, [state, today]);

  if (!ready) return null;

  if (!state.profile || !data) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Card>
          <Title>Welcome 👋</Title>
          <Muted>
            Set up your profile (weight, height, diet and goal) so the app can work out your daily calorie, protein and
            water targets.
          </Muted>
          <View style={{ height: 12 }} />
          <Button label="Set up profile" onPress={() => router.push('/food/profile')} />
        </Card>
      </ScrollView>
    );
  }

  const { targets, day, advice } = data;
  const todayFoods = state.foods.filter((f) => f.date === today);
  const todayWater = state.water.filter((w) => w.date === today);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card>
        <Title>Hi {state.profile.name || 'there'} 👋</Title>
        <Progress label="Calories" value={day.nutrients.kcal} target={targets.kcal} unit="kcal" />
        <Progress label="Protein" value={day.nutrients.protein} target={targets.protein} unit="g" />
        <Progress label="Carbs" value={day.nutrients.carbs} target={targets.carbs} unit="g" />
        <Progress label="Fat" value={day.nutrients.fat} target={targets.fat} unit="g" />
        <Progress label="Fibre" value={day.nutrients.fiber} target={targets.fiber} unit="g" />
      </Card>

      <Card>
        <Title>Water 💧</Title>
        <Progress label="Today" value={day.waterMl} target={targets.waterMl} unit="ml" color={colors.water} />
        <View style={styles.row}>
          {[150, 250, 500].map((ml) => (
            <View key={ml} style={{ flex: 1 }}>
              <Button variant="water" label={`+${ml} ml`} onPress={() => addWater(ml)} />
            </View>
          ))}
        </View>
        <View style={[styles.row, { marginTop: 8, alignItems: 'center' }]}>
          <TextInput
            value={customMl}
            onChangeText={setCustomMl}
            keyboardType="number-pad"
            placeholder="Other amount (ml)"
            placeholderTextColor={colors.muted}
            style={[styles.input, { flex: 1 }]}
          />
          <Button
            variant="secondary"
            label="Add"
            disabled={!(Number(customMl) > 0)}
            onPress={() => {
              addWater(Number(customMl));
              setCustomMl('');
            }}
          />
        </View>
        <View style={[styles.row, { marginTop: 8 }]}>
          {todayWater.slice(-6).map((w) => (
            <Pressable key={w.id} onLongPress={() => removeWater(w.id)} accessibilityHint="Long press to remove">
              <Text style={[styles.muted, { backgroundColor: colors.waterSoft, padding: 6, borderRadius: 8 }]}>
                {new Date(w.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {w.ml} ml
              </Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <Card style={{ backgroundColor: colors.primarySoft, borderColor: colors.primarySoft }}>
        <Title>🥗 What should I eat next?</Title>
        <Text style={[styles.text, { fontWeight: '700' }]}>{advice.headline}</Text>
        <Muted>{advice.reason}</Muted>
        {advice.suggestions.map((s) => (
          <Text key={s.food.name} style={[styles.text, { marginTop: 6 }]}>
            • {s.food.name}, {s.food.servingLabel} ({s.grams} g): {s.nutrients.kcal} kcal, {s.nutrients.protein} g
            protein, {s.nutrients.fiber} g fibre
          </Text>
        ))}
      </Card>

      <Card>
        <Title>Eaten today</Title>
        {todayFoods.length === 0 && <Muted>Nothing logged yet. Use the Log food tab.</Muted>}
        {MEALS.map((meal) => {
          const items = todayFoods.filter((f) => f.meal === meal);
          if (items.length === 0) return null;
          return (
            <View key={meal} style={{ marginBottom: 8 }}>
              <Text style={[styles.label, { textTransform: 'capitalize', marginTop: 4 }]}>{meal}</Text>
              {items.map((f) => (
                <View key={f.id} style={styles.listItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.text}>
                      {f.name}
                      {f.grams ? ` · ${f.grams} g` : ''}
                    </Text>
                    <Muted>
                      {f.kcal} kcal · P {f.protein} g · C {f.carbs} g · F {f.fat} g
                    </Muted>
                  </View>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${f.name}`} onPress={() => removeFood(f.id)}>
                    <Text style={{ color: colors.danger, fontSize: 18 }}>✕</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          );
        })}
      </Card>
    </ScrollView>
  );
}
