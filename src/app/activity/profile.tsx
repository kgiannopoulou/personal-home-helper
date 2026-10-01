import { useEffect, useState } from 'react';
import { ScrollView, Switch, Text, View } from 'react-native';
import { Button, Card, Chip, ChipRow, colors, Field, Muted, styles, Title } from '../../shared/ui';
import { isTime, WORKOUT_LABEL } from '../../modules/activity/lib/fitness';
import { applyTrainingReminders, remindersSupported } from '../../modules/activity/lib/reminders';
import { useStore } from '../../modules/activity/lib/store';
import type { Diet, TrainingSchedule, WorkoutType } from '../../modules/activity/lib/types';

const WEEKDAYS = [
  { n: 2, label: 'Mon' },
  { n: 3, label: 'Tue' },
  { n: 4, label: 'Wed' },
  { n: 5, label: 'Thu' },
  { n: 6, label: 'Fri' },
  { n: 7, label: 'Sat' },
  { n: 1, label: 'Sun' },
];

export default function ProfileScreen() {
  const { state, ready, setProfile } = useStore();
  const [form, setForm] = useState({ name: '', weightKg: '', diet: 'omnivore' as Diet, stepGoal: '8000', sleepGoalHours: '8' });
  const [saved, setSaved] = useState('');

  useEffect(() => {
    if (!ready || !state.profile) return;
    const p = state.profile;
    setForm({ name: p.name, diet: p.diet, weightKg: String(p.weightKg), stepGoal: String(p.stepGoal), sleepGoalHours: String(p.sleepGoalHours) });
  }, [ready, state.profile]);

  const set = <K extends keyof typeof form>(k: K) => (v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const weightKg = Number(form.weightKg.replace(',', '.'));
  const stepGoal = Number(form.stepGoal);
  const sleepGoalHours = Number(form.sleepGoalHours.replace(',', '.'));
  const valid = weightKg >= 30 && weightKg <= 300 && stepGoal >= 1000 && sleepGoalHours >= 4 && sleepGoalHours <= 12;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Card>
        <Title>About you</Title>
        <Field label="Name" value={form.name} onChangeText={set('name')} />
        <Field label="Weight (kg), used for calorie estimates" value={form.weightKg} onChangeText={set('weightKg')} keyboardType="decimal-pad" />
        <Text style={styles.label}>Diet (for food tips around workouts)</Text>
        <ChipRow
          value={form.diet}
          onChange={set('diet')}
          options={[
            { value: 'omnivore', label: 'Everything' },
            { value: 'vegetarian', label: 'Vegetarian' },
            { value: 'vegan', label: 'Vegan' },
          ]}
        />
        <View style={{ height: 12 }} />
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Field label="Daily step goal" value={form.stepGoal} onChangeText={set('stepGoal')} keyboardType="number-pad" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Sleep goal (h)" value={form.sleepGoalHours} onChangeText={set('sleepGoalHours')} keyboardType="decimal-pad" />
          </View>
        </View>
        <Button
          label="Save profile"
          disabled={!valid}
          onPress={() => {
            setProfile({ name: form.name.trim(), weightKg, diet: form.diet, stepGoal, sleepGoalHours });
            setSaved('Saved ✓');
            setTimeout(() => setSaved(''), 2000);
          }}
        />
        {!valid && <Muted>Enter a weight, a step goal of at least 1,000 and a sleep goal between 4 and 12 h.</Muted>}
        {!!saved && <Text style={{ color: colors.primary, marginTop: 8 }}>{saved}</Text>}
      </Card>
      <ScheduleCard />
    </ScrollView>
  );
}

function ScheduleCard() {
  const { state, setSchedule } = useStore();
  const [s, setS] = useState<TrainingSchedule>(state.schedule);
  const [status, setStatus] = useState('');
  useEffect(() => setS(state.schedule), [state.schedule]);

  const toggleDay = (n: number) =>
    setS((x) => ({ ...x, weekdays: x.weekdays.includes(n) ? x.weekdays.filter((d) => d !== n) : [...x.weekdays, n] }));

  const save = async () => {
    setSchedule(s);
    try {
      const count = await applyTrainingReminders(s);
      setStatus(
        !remindersSupported
          ? 'Saved. Reminders only work in the phone app.'
          : s.enabled
            ? `Saved ✓ ${count} weekly reminders scheduled.`
            : 'Saved. Reminders are off.',
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Could not schedule reminders');
    }
  };

  return (
    <Card>
      <Title>Training schedule</Title>
      <Muted>The app uses this to tell you what to eat and drink before and after training, and to remind you.</Muted>
      <View style={[styles.listItem, { borderBottomWidth: 0 }]}>
        <Text style={styles.text}>I train regularly</Text>
        <Switch value={s.enabled} onValueChange={(enabled) => setS({ ...s, enabled })} />
      </View>
      <View style={styles.row}>
        {WEEKDAYS.map((d) => (
          <Chip key={d.n} label={d.label} selected={s.weekdays.includes(d.n)} onPress={() => toggleDay(d.n)} />
        ))}
      </View>
      <View style={{ height: 12 }} />
      <Field label="Time" value={s.time} onChangeText={(time) => setS({ ...s, time })} placeholder="18:00" />
      <ChipRow
        value={s.type}
        onChange={(type: WorkoutType) => setS({ ...s, type })}
        options={(Object.keys(WORKOUT_LABEL) as WorkoutType[]).map((t) => ({ value: t, label: WORKOUT_LABEL[t] }))}
      />
      <View style={{ height: 12 }} />
      <Button label="Save schedule" disabled={!isTime(s.time)} onPress={save} />
      {!!status && <Muted>{status}</Muted>}
    </Card>
  );
}
