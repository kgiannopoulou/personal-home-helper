import { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Card, colors, Muted, styles, Title } from '../../shared/ui';
import { weekdayShort } from '../../shared/dates';
import { dailyTargets, suggestFoods, weekSummary, type Gap } from '../../modules/food/lib/nutrition';
import { useStore } from '../../modules/food/lib/store';

function Bars({ values, target, color, unit }: { values: { label: string; value: number }[]; target: number; color: string; unit: string }) {
  const max = Math.max(target * 1.25, ...values.map((v) => v.value), 1);
  const H = 120;
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: H, gap: 6 }}>
        {values.map((v) => (
          <View key={v.label} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: H }}>
            <View
              accessibilityLabel={`${v.label}: ${Math.round(v.value)} ${unit}`}
              style={{
                width: '70%',
                height: Math.max(2, (v.value / max) * H),
                backgroundColor: v.value > target * 1.1 ? colors.warn : color,
                borderRadius: 4,
              }}
            />
          </View>
        ))}
        {/* Target line */}
        <View
          pointerEvents="none"
          style={{ position: 'absolute', left: 0, right: 0, bottom: (target / max) * H, borderTopWidth: 1, borderStyle: 'dashed', borderColor: colors.muted }}
        />
      </View>
      <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
        {values.map((v) => (
          <Text key={v.label} style={[styles.muted, { flex: 1, textAlign: 'center', fontSize: 12 }]}>
            {v.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const GAP_TEXT: Record<Gap['key'], string> = {
  kcal: 'calories',
  protein: 'protein',
  carbs: 'carbs',
  fat: 'fat',
  fiber: 'fibre',
  water: 'water',
};

export default function Week() {
  const { state } = useStore();
  const summary = useMemo(() => {
    if (!state.profile) return null;
    const targets = dailyTargets(state.profile);
    return { targets, week: weekSummary(state.foods, state.water, targets) };
  }, [state]);

  if (!summary || !state.profile) {
    return (
      <View style={[styles.screen, styles.content]}>
        <Muted>Set up your profile first.</Muted>
      </View>
    );
  }
  const { targets, week } = summary;
  const diet = state.profile.diet;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card>
        <Title>Calories: last 7 days</Title>
        <Bars
          unit="kcal"
          target={targets.kcal}
          color={colors.primary}
          values={week.days.map((d) => ({ label: weekdayShort(d.date), value: d.nutrients.kcal }))}
        />
        <Muted>
          Average {Math.round(week.average.kcal)} kcal on {week.loggedDays} logged day(s) · target {targets.kcal}
        </Muted>
      </Card>

      <Card>
        <Title>Water: last 7 days</Title>
        <Bars
          unit="ml"
          target={targets.waterMl}
          color={colors.water}
          values={week.days.map((d) => ({ label: weekdayShort(d.date), value: d.waterMl }))}
        />
        <Muted>
          Average {week.average.waterMl} ml · target {targets.waterMl} ml
        </Muted>
      </Card>

      <Card>
        <Title>Daily averages</Title>
        {(['protein', 'carbs', 'fat', 'fiber'] as const).map((k) => (
          <View key={k} style={styles.listItem}>
            <Text style={styles.text}>{GAP_TEXT[k][0].toUpperCase() + GAP_TEXT[k].slice(1)}</Text>
            <Muted>
              {Math.round(week.average[k])} g / {targets[k]} g
            </Muted>
          </View>
        ))}
      </Card>

      <Card>
        <Title>What to work on</Title>
        {week.loggedDays === 0 && <Muted>Log some meals and your weekly insights will show up here.</Muted>}
        {week.loggedDays > 0 && week.gaps.length === 0 && <Muted>🎉 You're hitting your targets this week. Keep it up!</Muted>}
        {week.gaps.map((g) => {
          const pct = Math.round(g.ratio * 100);
          const tips =
            g.key === 'protein' || g.key === 'fiber' ? suggestFoods(g.key, diet).map((s) => s.food.name.toLowerCase()) : [];
          return (
            <View key={g.key + g.direction} style={{ marginBottom: 10 }}>
              <Text style={[styles.text, { fontWeight: '700' }]}>
                {g.direction === 'low' ? '⬇️' : '⬆️'} {GAP_TEXT[g.key]} at {pct}% of target
              </Text>
              <Muted>
                {g.key === 'water'
                  ? 'Keep a bottle nearby and turn on water reminders in Profile.'
                  : g.key === 'kcal' && g.direction === 'high'
                    ? 'Check portion sizes and snacks. Lighter, high-fibre foods keep you full.'
                    : g.key === 'kcal'
                      ? 'You may be under-eating (or forgetting to log). Aim for regular meals.'
                      : `Easy wins: ${tips.join(', ')}.`}
              </Muted>
            </View>
          );
        })}
      </Card>
    </ScrollView>
  );
}
