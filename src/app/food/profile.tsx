import { useEffect, useState } from 'react';
import { ScrollView, Switch, Text, View } from 'react-native';
import { Button, Card, ChipRow, colors, Field, Muted, styles, Title } from '../../shared/ui';
import { dailyTargets } from '../../modules/food/lib/nutrition';
import { applyReminders, remindersSupported, waterReminderHours } from '../../modules/food/lib/reminders';
import { getApiKey, setApiKey } from '../../modules/food/lib/storage';
import { useStore } from '../../modules/food/lib/store';
import type { ActivityLevel, Diet, Goal, Profile, ReminderSettings, Sex } from '../../modules/food/lib/types';

const blank = { name: '', sex: 'female' as Sex, age: '', heightCm: '', weightKg: '', activity: 'light' as ActivityLevel, goal: 'maintain' as Goal, diet: 'omnivore' as Diet };

export default function ProfileScreen() {
  const { state, ready, setProfile } = useStore();
  const [form, setForm] = useState(blank);
  const [saved, setSaved] = useState('');

  useEffect(() => {
    if (!ready || !state.profile) return;
    const p = state.profile;
    setForm({ ...p, age: String(p.age), heightCm: String(p.heightCm), weightKg: String(p.weightKg) });
  }, [ready, state.profile]);

  const set = <K extends keyof typeof form>(k: K) => (v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const age = Number(form.age);
  const heightCm = Number(form.heightCm.replace(',', '.'));
  const weightKg = Number(form.weightKg.replace(',', '.'));
  const valid = age >= 13 && age <= 110 && heightCm >= 100 && heightCm <= 250 && weightKg >= 30 && weightKg <= 300;
  const draft: Profile | null = valid ? { ...form, name: form.name.trim(), age, heightCm, weightKg } : null;
  const targets = draft ? dailyTargets(draft) : null;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Card>
        <Title>About you</Title>
        <Field label="Name" value={form.name} onChangeText={set('name')} />
        <Text style={styles.label}>Sex (for the calorie formula)</Text>
        <ChipRow value={form.sex} onChange={set('sex')} options={[{ value: 'female', label: 'Female' }, { value: 'male', label: 'Male' }]} />
        <View style={{ height: 12 }} />
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Field label="Age" value={form.age} onChangeText={set('age')} keyboardType="number-pad" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Height (cm)" value={form.heightCm} onChangeText={set('heightCm')} keyboardType="decimal-pad" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Weight (kg)" value={form.weightKg} onChangeText={set('weightKg')} keyboardType="decimal-pad" />
          </View>
        </View>
        <Text style={styles.label}>Diet</Text>
        <ChipRow
          value={form.diet}
          onChange={set('diet')}
          options={[{ value: 'omnivore', label: 'Everything' }, { value: 'vegetarian', label: 'Vegetarian' }, { value: 'vegan', label: 'Vegan' }]}
        />
        <View style={{ height: 12 }} />
        <Text style={styles.label}>Goal</Text>
        <ChipRow
          value={form.goal}
          onChange={set('goal')}
          options={[{ value: 'lose', label: 'Lose weight' }, { value: 'maintain', label: 'Maintain' }, { value: 'gain', label: 'Build muscle' }]}
        />
        <View style={{ height: 12 }} />
        <Text style={styles.label}>How active are you?</Text>
        <ChipRow
          value={form.activity}
          onChange={set('activity')}
          options={[
            { value: 'sedentary', label: 'Desk, little exercise' },
            { value: 'light', label: '1–3 workouts/wk' },
            { value: 'moderate', label: '3–5 workouts/wk' },
            { value: 'active', label: '6–7 workouts/wk' },
            { value: 'very_active', label: 'Physical job + training' },
          ]}
        />
        {targets && (
          <View style={{ marginTop: 12, padding: 12, backgroundColor: colors.primarySoft, borderRadius: 12 }}>
            <Text style={[styles.text, { fontWeight: '700' }]}>Your daily targets</Text>
            <Muted>
              {targets.kcal} kcal · protein {targets.protein} g · carbs {targets.carbs} g · fat {targets.fat} g · fibre{' '}
              {targets.fiber} g · water {targets.waterMl} ml
            </Muted>
          </View>
        )}
        <View style={{ height: 12 }} />
        <Button
          label="Save profile"
          disabled={!draft}
          onPress={() => {
            if (!draft) return;
            setProfile(draft);
            setSaved('Saved ✓');
            setTimeout(() => setSaved(''), 2000);
          }}
        />
        {!valid && (form.age || form.heightCm || form.weightKg) ? <Muted>Enter a valid age, height and weight.</Muted> : null}
        {!!saved && <Text style={{ color: colors.primary, marginTop: 8 }}>{saved}</Text>}
      </Card>

      <RemindersCard />
      <ApiKeyCard />
    </ScrollView>
  );
}

function RemindersCard() {
  const { state, setReminders } = useStore();
  const [r, setR] = useState<ReminderSettings>(state.reminders);
  const [status, setStatus] = useState('');
  useEffect(() => setR(state.reminders), [state.reminders]);

  if (!remindersSupported) {
    return (
      <Card>
        <Title>Reminders</Title>
        <Muted>Water and meal reminders work in the phone app (Android/iOS), not in the browser.</Muted>
      </Card>
    );
  }

  const save = async () => {
    try {
      const count = await applyReminders(r);
      setReminders(r);
      setStatus(r.enabled ? `${count} daily reminders scheduled ✓` : 'Reminders turned off');
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Could not schedule reminders');
    }
  };

  const hour = (v: string) => Math.min(23, Math.max(0, Number(v) || 0));
  return (
    <Card>
      <Title>Reminders</Title>
      <View style={[styles.listItem, { borderBottomWidth: 0 }]}>
        <Text style={styles.text}>Water & meal reminders</Text>
        <Switch value={r.enabled} onValueChange={(enabled) => setR({ ...r, enabled })} />
      </View>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Field label="Wake (hour)" value={String(r.wakeHour)} onChangeText={(v) => setR({ ...r, wakeHour: hour(v) })} keyboardType="number-pad" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Sleep (hour)" value={String(r.sleepHour)} onChangeText={(v) => setR({ ...r, sleepHour: hour(v) })} keyboardType="number-pad" />
        </View>
        <View style={{ flex: 1 }}>
          <Field
            label="Water every (h)"
            value={String(r.waterEveryHours)}
            onChangeText={(v) => setR({ ...r, waterEveryHours: Math.max(1, Number(v) || 1) })}
            keyboardType="number-pad"
          />
        </View>
      </View>
      <Muted>Water reminders at: {waterReminderHours(r).map((h) => `${h}:00`).join(', ') || 'none'}</Muted>
      <View style={[styles.row, { marginTop: 12 }]}>
        {(['breakfast', 'lunch', 'dinner'] as const).map((m) => (
          <View key={m} style={{ flex: 1 }}>
            <Field
              label={m[0].toUpperCase() + m.slice(1)}
              value={r.meals[m]}
              onChangeText={(v) => setR({ ...r, meals: { ...r.meals, [m]: v } })}
              placeholder="HH:MM"
            />
          </View>
        ))}
      </View>
      <Button label="Save reminders" onPress={save} />
      {!!status && <Muted>{status}</Muted>}
    </Card>
  );
}

function ApiKeyCard() {
  const [key, setKey] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [status, setStatus] = useState('');
  useEffect(() => {
    getApiKey().then((k) => setHasKey(!!k));
  }, []);

  return (
    <Card>
      <Title>AI meal recognition</Title>
      <Muted>
        Photo and text meal estimates use Claude. Paste your own Anthropic API key (console.anthropic.com). It's stored
        only on this device{hasKey ? ', and one is saved now' : ''}.
      </Muted>
      <View style={{ height: 8 }} />
      <Field label="Anthropic API key" value={key} onChangeText={setKey} placeholder={hasKey ? '•••••• (saved)' : 'sk-ant-…'} secureTextEntry autoCapitalize="none" />
      <View style={styles.row}>
        <Button
          label="Save key"
          disabled={!key.trim()}
          onPress={async () => {
            await setApiKey(key.trim());
            setKey('');
            setHasKey(true);
            setStatus('Key saved ✓');
          }}
        />
        {hasKey && (
          <Button
            variant="secondary"
            label="Remove key"
            onPress={async () => {
              await setApiKey('');
              setHasKey(false);
              setStatus('Key removed');
            }}
          />
        )}
      </View>
      {!!status && <Muted>{status}</Muted>}
    </Card>
  );
}
