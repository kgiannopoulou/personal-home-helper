import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Button, Card, colors, Field, Muted, styles, Title } from '../../shared/ui';
import { formatMinutes, plannedWeeklyLoad, WEEKDAYS, weekWorkload } from '../../modules/chores/lib/chores';
import { useStore } from '../../modules/chores/lib/store';

// Monday first, like a calendar week.
const ORDER = [1, 2, 3, 4, 5, 6, 0];

function FreeTimeCard() {
  const { state, setSettings } = useStore();
  const [values, setValues] = useState(state.settings.dailyMinutes.map(String));
  const [saved, setSaved] = useState('');
  useEffect(() => setValues(state.settings.dailyMinutes.map(String)), [state.settings.dailyMinutes]);
  const nums = values.map(Number);
  const valid = nums.every((n) => Number.isInteger(n) && n >= 0 && n <= 600);

  return (
    <Card>
      <Title>Time for chores</Title>
      <Muted>
        Minutes you have for chores each day. Busy days get just the essentials, and the rest moves to days with more
        time.
      </Muted>
      <View style={{ height: 10 }} />
      <View style={styles.row}>
        {ORDER.map((d) => (
          <View key={d} style={{ width: 80 }}>
            <Field
              label={WEEKDAYS[d].slice(0, 3)}
              value={values[d]}
              onChangeText={(v) => setValues(values.map((x, i) => (i === d ? v : x)))}
              keyboardType="number-pad"
            />
          </View>
        ))}
      </View>
      <Button
        label="Save"
        disabled={!valid}
        onPress={() => {
          setSettings({ ...state.settings, dailyMinutes: nums });
          setSaved('Saved ✓');
          setTimeout(() => setSaved(''), 2000);
        }}
      />
      {!!saved && <Text style={{ color: colors.primary, marginTop: 8 }}>{saved}</Text>}
    </Card>
  );
}

export default function Household() {
  const { state, addMember, removeMember, setMe, shareFairly } = useStore();
  const [name, setName] = useState('');
  const done = useMemo(() => weekWorkload(state.completions, state.members), [state.completions, state.members]);
  const planned = useMemo(() => plannedWeeklyLoad(state.tasks, state.members), [state.tasks, state.members]);
  const maxDone = Math.max(...done.map((d) => d.minutes), 1);
  const unassigned = state.tasks.filter((t) => !t.assignee).length;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Card>
        <Title>👥 Household</Title>
        <Muted>Add the people you live with to share chores fairly, by time spent rather than number of chores.</Muted>
        <View style={{ height: 8 }} />
        {state.members.map((m) => (
          <View key={m.id} style={styles.listItem}>
            <Text style={[styles.text, { flex: 1 }]}>
              {m.name}
              {m.id === state.meId ? ' (me, on this phone)' : ''}
            </Text>
            {m.id !== state.meId && (
              <Pressable accessibilityRole="button" onPress={() => setMe(m.id)} hitSlop={8}>
                <Text style={{ color: colors.primary }}>This is me</Text>
              </Pressable>
            )}
            <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${m.name}`} onPress={() => removeMember(m.id)} hitSlop={8}>
              <Text style={{ color: colors.danger, fontSize: 18 }}>✕</Text>
            </Pressable>
          </View>
        ))}
        <View style={{ height: 8 }} />
        <View style={[styles.row, { alignItems: 'flex-end' }]}>
          <View style={{ flex: 1 }}>
            <Field label={state.members.length ? 'Add someone' : 'Your name'} value={name} onChangeText={setName} placeholder="e.g. Maria" />
          </View>
          <View style={{ marginBottom: 12 }}>
            <Button
              label="Add"
              variant="secondary"
              disabled={!name.trim()}
              onPress={() => {
                addMember(name);
                setName('');
              }}
            />
          </View>
        </View>
      </Card>

      {state.members.length > 1 && (
        <>
          <Card>
            <Title>This week so far</Title>
            {done.map((d) => (
              <View key={d.member.id} style={{ marginBottom: 8 }}>
                <View style={styles.progressHeader}>
                  <Text style={styles.label}>{d.member.name}</Text>
                  <Muted>{formatMinutes(d.minutes)}</Muted>
                </View>
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${(d.minutes / maxDone) * 100}%`, backgroundColor: colors.primary }]} />
                </View>
              </View>
            ))}
            <Muted>Minutes of chores ticked off since Monday.</Muted>
          </Card>

          <Card>
            <Title>⚖️ Fair share</Title>
            {planned.map((p) => (
              <View key={p.member.id} style={styles.listItem}>
                <Text style={styles.text}>{p.member.name}</Text>
                <Text style={styles.text}>~{formatMinutes(p.minutes)} / week</Text>
              </View>
            ))}
            {unassigned > 0 && <Muted>{unassigned} task(s) aren't assigned to anyone yet.</Muted>}
            <View style={{ height: 10 }} />
            <Button label="Share chores fairly" onPress={shareFairly} />
            <Muted>Splits every cleaning task so everyone has about the same minutes per week. You can still change any task in Rooms.</Muted>
          </Card>
        </>
      )}

      <FreeTimeCard />

      <Card>
        <Title>Connected apps</Title>
        <Muted>Supplies that run low can be sent to 🛒 Smart Shopping List with one tap.</Muted>
      </Card>
    </ScrollView>
  );
}
