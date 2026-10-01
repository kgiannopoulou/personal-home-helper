import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { LaundryCard, useNow } from '../../modules/chores/components/Laundry';
import { TaskRow } from '../../modules/chores/components/TaskRow';
import { Button, Card, ChipRow, Field, Muted, styles, Title } from '../../shared/ui';
import { cleaningPlan, formatMinutes } from '../../modules/chores/lib/chores';
import { notificationsSupported } from '../../modules/chores/lib/notifications';
import { useStore } from '../../modules/chores/lib/store';
import type { LaundryType } from '../../modules/chores/lib/types';

const TIMES = [15, 30, 45, 60, 90, 120].map((m) => ({ value: String(m), label: formatMinutes(m) }));
const LAUNDRY: { value: LaundryType; label: string }[] = [
  { value: 'whites', label: '⚪ Whites' },
  { value: 'colours', label: '🌈 Colours' },
  { value: 'darks', label: '⚫ Darks' },
  { value: 'mixed', label: '🧦 Mixed' },
];

export default function Clean() {
  const { state, startLaundry, setSettings } = useStore();
  const now = useNow();
  const [time, setTime] = useState('45');
  const groups = useMemo(() => cleaningPlan(state.tasks, state.rooms, Number(time), now), [state.tasks, state.rooms, time, now]);
  const total = groups.reduce((m, g) => m + g.minutes, 0);

  const [type, setType] = useState<LaundryType>('mixed');
  const [cycle, setCycle] = useState(String(state.settings.laundryMinutes));
  const cycleMinutes = Number(cycle);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Card>
        <Title>🧼 Clean my house</Title>
        <Muted>How much time do you have? The plan picks what has gone longest without cleaning, room by room.</Muted>
        <View style={{ height: 10 }} />
        <ChipRow options={TIMES} value={time} onChange={setTime} />
      </Card>

      {groups.length === 0 ? (
        <Card>
          <Muted>Your home is in great shape. Nothing needs cleaning yet! ✨</Muted>
        </Card>
      ) : (
        <Card>
          <Title>Cleaning plan · {formatMinutes(total)}</Title>
          {groups.map((g) => (
            <View key={g.room.id} style={{ marginBottom: 6 }}>
              <Text style={[styles.label, { marginTop: 6 }]}>
                {g.room.emoji} {g.room.name} · {formatMinutes(g.minutes)}
              </Text>
              {g.tasks.map((t) => (
                <TaskRow key={t.id} task={t} showRoom={false} />
              ))}
            </View>
          ))}
        </Card>
      )}

      <LaundryCard />

      <Card>
        <Title>🧺 Start a laundry load</Title>
        <ChipRow options={LAUNDRY} value={type} onChange={setType} />
        <View style={{ height: 10 }} />
        <Field label="Cycle length (minutes)" value={cycle} onChangeText={setCycle} keyboardType="number-pad" />
        <Button
          label={state.laundry ? 'Start a new load' : 'Start load'}
          disabled={!(cycleMinutes >= 5 && cycleMinutes <= 600)}
          onPress={() => {
            if (cycleMinutes !== state.settings.laundryMinutes) setSettings({ ...state.settings, laundryMinutes: cycleMinutes });
            startLaundry(type, cycleMinutes);
          }}
        />
        <Muted>
          {notificationsSupported
            ? "You'll get a notification when it should be ready."
            : 'Notifications only work on a phone; the timer still shows here.'}
        </Muted>
      </Card>
    </ScrollView>
  );
}
