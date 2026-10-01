import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Button, Card, ChipRow, colors, Field, Muted, styles, Title } from '../../shared/ui';
import { toDateKey } from '../../shared/dates';
import { isTime, sleepHours, workoutKcal, WORKOUT_LABEL } from '../../modules/activity/lib/fitness';
import { useStore } from '../../modules/activity/lib/store';
import type { Intensity, WorkoutType } from '../../modules/activity/lib/types';

type Tab = 'workout' | 'sleep' | 'weight';

export default function Log() {
  const [tab, setTab] = useState<Tab>('workout');
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <ChipRow
        value={tab}
        onChange={setTab}
        options={[
          { value: 'workout', label: '🏋️ Workout' },
          { value: 'sleep', label: '😴 Sleep' },
          { value: 'weight', label: '⚖️ Weight' },
        ]}
      />
      {tab === 'workout' && <WorkoutLog />}
      {tab === 'sleep' && <SleepLog />}
      {tab === 'weight' && <WeightLog />}
    </ScrollView>
  );
}

function Remove({ onPress, label }: { onPress: () => void; label: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${label}`} onPress={onPress} hitSlop={8}>
      <Text style={{ color: colors.danger, fontSize: 18 }}>✕</Text>
    </Pressable>
  );
}

function WorkoutLog() {
  const { state, addWorkout, removeWorkout } = useStore();
  const [type, setType] = useState<WorkoutType>('gym');
  const [intensity, setIntensity] = useState<Intensity>('moderate');
  const [minutes, setMinutes] = useState('45');
  const mins = Number(minutes);
  const kcal = mins > 0 ? workoutKcal(type, intensity, mins, state.profile?.weightKg ?? 70) : 0;
  const recent = [...state.workouts].reverse().slice(0, 10);

  return (
    <>
      <Card>
        <Title>Log a workout</Title>
        <ChipRow
          value={type}
          onChange={setType}
          options={(Object.keys(WORKOUT_LABEL) as WorkoutType[]).map((t) => ({ value: t, label: WORKOUT_LABEL[t] }))}
        />
        <View style={{ height: 12 }} />
        <Text style={styles.label}>Intensity</Text>
        <ChipRow
          value={intensity}
          onChange={setIntensity}
          options={[
            { value: 'easy', label: 'Easy' },
            { value: 'moderate', label: 'Moderate' },
            { value: 'hard', label: 'Hard' },
          ]}
        />
        <View style={{ height: 12 }} />
        <Field label="Minutes" value={minutes} onChangeText={setMinutes} keyboardType="number-pad" />
        <Muted>≈ {kcal} kcal</Muted>
        <View style={{ height: 8 }} />
        <Button
          label="Save workout"
          disabled={!(mins > 0 && mins < 600)}
          onPress={() => {
            addWorkout({ type, intensity, minutes: mins });
          }}
        />
      </Card>
      <Card>
        <Title>Recent</Title>
        {recent.length === 0 && <Muted>No workouts yet.</Muted>}
        {recent.map((w) => (
          <View key={w.id} style={styles.listItem}>
            <View style={{ flex: 1 }}>
              <Text style={styles.text}>
                {WORKOUT_LABEL[w.type]} · {w.minutes} min · {w.intensity}
              </Text>
              <Muted>
                {w.date} · {w.kcal} kcal{w.source === 'coach' ? ' · coach' : ''}
              </Muted>
            </View>
            <Remove label="workout" onPress={() => removeWorkout(w.id)} />
          </View>
        ))}
      </Card>
    </>
  );
}

function SleepLog() {
  const { state, addSleep, removeSleep } = useStore();
  const [bedtime, setBedtime] = useState('23:00');
  const [wake, setWake] = useState('07:00');
  const [quality, setQuality] = useState('3');
  const valid = isTime(bedtime) && isTime(wake);
  const hours = valid ? sleepHours(bedtime, wake) : 0;
  const goal = state.profile?.sleepGoalHours ?? 8;
  const recent = [...state.sleep].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7);

  return (
    <>
      <Card>
        <Title>Last night's sleep</Title>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Field label="Went to bed" value={bedtime} onChangeText={setBedtime} placeholder="23:00" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Woke up" value={wake} onChangeText={setWake} placeholder="07:00" />
          </View>
        </View>
        <Text style={styles.label}>How did you sleep?</Text>
        <ChipRow
          value={quality}
          onChange={setQuality}
          options={['1', '2', '3', '4', '5'].map((q) => ({ value: q, label: ['😫', '😕', '😐', '🙂', '😄'][Number(q) - 1] }))}
        />
        <View style={{ height: 8 }} />
        {valid ? (
          <Muted>
            {hours} h{hours < goal ? `, ${Math.round((goal - hours) * 10) / 10} h under your goal` : ' 👍'}
          </Muted>
        ) : (
          <Muted>Use HH:MM, e.g. 23:30</Muted>
        )}
        <View style={{ height: 8 }} />
        <Button
          label="Save sleep"
          disabled={!valid}
          onPress={() => addSleep({ date: toDateKey(), bedtime, wake, hours, quality: Number(quality) })}
        />
      </Card>
      <Card>
        <Title>Recent nights</Title>
        {recent.length === 0 && <Muted>No sleep logged yet.</Muted>}
        {recent.map((s) => (
          <View key={s.id} style={styles.listItem}>
            <Text style={styles.text}>
              {s.date} · {s.hours} h {['😫', '😕', '😐', '🙂', '😄'][s.quality - 1]}
            </Text>
            <Remove label="sleep entry" onPress={() => removeSleep(s.id)} />
          </View>
        ))}
      </Card>
    </>
  );
}

function WeightLog() {
  const { state, addWeight, removeWeight } = useStore();
  const [kg, setKg] = useState(state.profile ? String(state.profile.weightKg) : '');
  const value = Number(kg.replace(',', '.'));
  const recent = [...state.weights].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);

  return (
    <>
      <Card>
        <Title>Weigh-in</Title>
        <Muted>Once a week, same time of day (e.g. Monday morning), gives the most useful trend.</Muted>
        <View style={{ height: 8 }} />
        <Field label="Weight (kg)" value={kg} onChangeText={setKg} keyboardType="decimal-pad" />
        <Button label="Save weight" disabled={!(value >= 30 && value <= 300)} onPress={() => addWeight(value)} />
      </Card>
      <Card>
        <Title>History</Title>
        {recent.length === 0 && <Muted>No weigh-ins yet.</Muted>}
        {recent.map((w, i) => {
          const prev = recent[i + 1];
          const diff = prev ? Math.round((w.kg - prev.kg) * 10) / 10 : null;
          return (
            <View key={w.id} style={styles.listItem}>
              <Text style={styles.text}>
                {w.date} · {w.kg} kg
              </Text>
              <View style={[styles.row, { alignItems: 'center' }]}>
                {diff !== null && <Muted>{diff > 0 ? `+${diff}` : diff} kg</Muted>}
                <Remove label="weigh-in" onPress={() => removeWeight(w.id)} />
              </View>
            </View>
          );
        })}
      </Card>
    </>
  );
}
