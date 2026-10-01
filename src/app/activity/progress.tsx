import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Card, ChipRow, colors, Muted, styles, Title } from '../../shared/ui';
import { fromDateKey } from '../../shared/dates';
import { periodSummary, reviewInsights } from '../../modules/activity/lib/fitness';
import { useStore } from '../../modules/activity/lib/store';

function Bars({ values, target, color, labelEvery = 1 }: { values: { label: string; value: number }[]; target?: number; color: string; labelEvery?: number }) {
  const H = 100;
  const max = Math.max(target ? target * 1.2 : 0, ...values.map((v) => v.value), 1);
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: H, gap: values.length > 10 ? 2 : 6 }}>
        {values.map((v, i) => (
          <View key={i} style={{ flex: 1, height: H, justifyContent: 'flex-end' }}>
            <View
              accessibilityLabel={`${v.label}: ${v.value}`}
              style={{ height: Math.max(v.value > 0 ? 2 : 0, (v.value / max) * H), backgroundColor: color, borderRadius: 3 }}
            />
          </View>
        ))}
        {target ? (
          <View
            pointerEvents="none"
            style={{ position: 'absolute', left: 0, right: 0, bottom: (target / max) * H, borderTopWidth: 1, borderStyle: 'dashed', borderColor: colors.muted }}
          />
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', gap: values.length > 10 ? 2 : 6, marginTop: 4 }}>
        {values.map((v, i) => (
          <Text key={i} style={[styles.muted, { flex: 1, textAlign: 'center', fontSize: 11 }]} numberOfLines={1}>
            {i % labelEvery === 0 ? v.label : ''}
          </Text>
        ))}
      </View>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexBasis: '45%', flexGrow: 1, padding: 12, borderRadius: 12, backgroundColor: colors.bg }}>
      <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>{value}</Text>
      <Muted>{label}</Muted>
    </View>
  );
}

export default function Progress() {
  const { state } = useStore();
  const [period, setPeriod] = useState<'7' | '30'>('7');
  const days = Number(period);
  const summary = useMemo(() => periodSummary(state, days), [state, days]);
  const insights = reviewInsights(summary, state.profile, days);
  const label = (k: string) =>
    days === 7 ? fromDateKey(k).toLocaleDateString(undefined, { weekday: 'short' }) : String(fromDateKey(k).getDate());
  const sleepByDate = new Map(state.sleep.map((s) => [s.date, s.hours]));
  const minutesByDate = new Map<string, number>();
  for (const w of state.workouts) minutesByDate.set(w.date, (minutesByDate.get(w.date) ?? 0) + w.minutes);
  const weights = [...state.weights].sort((a, b) => a.date.localeCompare(b.date)).slice(-12);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <ChipRow
        value={period}
        onChange={setPeriod}
        options={[
          { value: '7', label: 'Weekly review' },
          { value: '30', label: 'Monthly review' },
        ]}
      />
      <Card>
        <Title>{days === 7 ? 'This week' : 'Last 30 days'}</Title>
        <View style={styles.row}>
          <Stat label="workouts" value={String(summary.workouts)} />
          <Stat label="active minutes" value={String(summary.activeMinutes)} />
          <Stat label="kcal from workouts" value={summary.workoutKcal.toLocaleString()} />
          <Stat label="avg steps/day" value={summary.avgSteps.toLocaleString()} />
          <Stat label="avg sleep" value={summary.avgSleep !== null ? `${summary.avgSleep} h` : '–'} />
          <Stat
            label="weight change"
            value={summary.weightChange !== null ? `${summary.weightChange > 0 ? '+' : ''}${summary.weightChange} kg` : '–'}
          />
        </View>
      </Card>

      <Card>
        <Title>Review</Title>
        {insights.map((i) => (
          <Text key={i} style={[styles.text, { marginBottom: 6 }]}>
            {i}
          </Text>
        ))}
      </Card>

      <Card>
        <Title>Steps</Title>
        <Bars
          color={colors.primary}
          target={state.profile?.stepGoal}
          labelEvery={days === 7 ? 1 : 5}
          values={summary.days.map((d) => ({ label: label(d), value: state.steps[d] ?? 0 }))}
        />
      </Card>

      <Card>
        <Title>Active minutes</Title>
        <Bars
          color={colors.warn}
          labelEvery={days === 7 ? 1 : 5}
          values={summary.days.map((d) => ({ label: label(d), value: minutesByDate.get(d) ?? 0 }))}
        />
      </Card>

      <Card>
        <Title>Sleep</Title>
        <Bars
          color={colors.water}
          target={state.profile?.sleepGoalHours}
          labelEvery={days === 7 ? 1 : 5}
          values={summary.days.map((d) => ({ label: label(d), value: sleepByDate.get(d) ?? 0 }))}
        />
      </Card>

      <Card>
        <Title>Weight trend</Title>
        {weights.length < 2 ? (
          <Muted>Log your weight weekly to see a trend.</Muted>
        ) : (
          <>
            <Bars
              color={colors.muted}
              values={(() => {
                // Bars start just below the lowest weight so small changes are visible.
                const floor = Math.floor(Math.min(...weights.map((w) => w.kg)) - 1);
                return weights.map((w) => ({ label: w.date.slice(5), value: Math.round((w.kg - floor) * 10) / 10 }));
              })()}
            />
            <Muted>
              {weights[0].kg} kg → {weights[weights.length - 1].kg} kg over the last {weights.length} weigh-ins
            </Muted>
          </>
        )}
      </Card>
    </ScrollView>
  );
}
