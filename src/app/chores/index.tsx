import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { LaundryCard, useNow } from '../../modules/chores/components/Laundry';
import { DoneRow, TaskRow } from '../../modules/chores/components/TaskRow';
import { Button, Card, Chip, colors, Muted, Progress, styles, Title } from '../../shared/ui';
import {
  doneToday,
  formatMinutes,
  frequencyLabel,
  needsBuying,
  planForTime,
  routineSuggestions,
  todayPlan,
  WEEKDAYS,
} from '../../modules/chores/lib/chores';
import { toDateKey } from '../../shared/dates';
import { useStore } from '../../modules/chores/lib/store';

const QUICK = [5, 10, 15, 30, 45, 60];

export default function Today() {
  const { state, pinToday, updateTask } = useStore();
  const router = useRouter();
  const now = useNow();
  const capacity = state.settings.dailyMinutes[now.getDay()] ?? 30;
  const pinnedIds = state.pinned.date === toDateKey(now) ? state.pinned.taskIds : [];
  const plan = useMemo(() => todayPlan(state.tasks, pinnedIds, capacity, now), [state.tasks, pinnedIds, capacity, now]);
  const done = state.tasks.filter((t) => doneToday(t, now));
  const doneMinutes = done.reduce((m, t) => m + t.minutes, 0);
  const suggestions = routineSuggestions(
    state.tasks,
    state.completions,
    plan.tasks.map((t) => t.id),
    now,
  );
  const lowSupplies = state.supplies.filter(needsBuying);
  const learned = state.tasks.filter((t) => t.learned && !t.learned.seen);

  const [quick, setQuick] = useState<number | null>(null);
  const mission = quick ? planForTime(state.tasks, quick, now) : null;

  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card>
        <Title>
          {greeting} 👋
        </Title>
        <Muted>
          {WEEKDAYS[now.getDay()]}: you have about {formatMinutes(capacity)} for chores today
          {capacity <= 20 ? ' (busy day, so just the essentials)' : ''}.
        </Muted>
        <View style={{ height: 10 }} />
        <Progress label="Done today" value={doneMinutes} target={Math.max(plan.minutes + doneMinutes, 1)} unit="min" />
      </Card>

      <LaundryCard />

      {learned.length > 0 && (
        <Card style={{ backgroundColor: colors.primarySoft }}>
          <Title>📈 Learned from your habits</Title>
          {learned.map((t) => {
            const from = t.learned!.from;
            return (
              <View key={t.id} style={{ gap: 6, paddingVertical: 4 }}>
                <Text style={styles.text}>
                  <Text style={{ fontWeight: '700' }}>{t.name}</Text>: now {frequencyLabel(t.everyDays).toLowerCase()} instead of{' '}
                  {frequencyLabel(from).toLowerCase()}, since you {t.everyDays > from ? 'usually leave it longer' : 'usually do it sooner'}.
                </Text>
                <View style={styles.row}>
                  <Chip label="👍 Keep" onPress={() => updateTask(t.id, { learned: { ...t.learned!, seen: true } })} />
                  <Chip label={`↩︎ Undo (${frequencyLabel(from).toLowerCase()})`} onPress={() => updateTask(t.id, { everyDays: from, learned: undefined, fixedFrequency: true })} />
                </View>
              </View>
            );
          })}
        </Card>
      )}

      {suggestions.map((t) => {
        const room = state.rooms.find((r) => r.id === t.roomId);
        return (
          <Card key={t.id} style={{ backgroundColor: colors.primarySoft }}>
            <Text style={styles.text}>
              🔁 You normally do <Text style={{ fontWeight: '700' }}>{t.name.toLowerCase()}</Text>
              {room && !room.personal ? ` (${room.name.toLowerCase()})` : ''} on {WEEKDAYS[now.getDay()]}s. Want to add it to
              today's plan?
            </Text>
            <View style={{ height: 8 }} />
            <Button label={`Add to today · ${formatMinutes(t.minutes)}`} variant="secondary" onPress={() => pinToday(t.id)} />
          </Card>
        );
      })}

      <Card>
        <Title>Today's plan · {formatMinutes(plan.minutes)}</Title>
        {plan.tasks.length === 0 && <Muted>Nothing due. Enjoy your free time! ✨</Muted>}
        {plan.tasks.map((t) => (
          <TaskRow key={t.id} task={t} />
        ))}
        {plan.postponed > 0 && (
          <Muted>
            {plan.postponed} more due task{plan.postponed === 1 ? '' : 's'} left for a day with more time. Change your free time
            per day in Household.
          </Muted>
        )}
        {done.length > 0 && (
          <>
            <View style={{ height: 8 }} />
            {done.map((t) => (
              <DoneRow key={t.id} task={t} />
            ))}
          </>
        )}
      </Card>

      <Card>
        <Title>⚡ I only have…</Title>
        <View style={styles.row}>
          {QUICK.map((m) => (
            <Chip key={m} label={`${m} min`} selected={quick === m} onPress={() => setQuick(quick === m ? null : m)} />
          ))}
        </View>
        {mission && (
          <View style={{ marginTop: 10 }}>
            <Text style={styles.label}>
              {quick}-minute mission{mission.tasks.length ? ` · ${formatMinutes(mission.minutes)}` : ''}
            </Text>
            {mission.tasks.length === 0 && <Muted>Nothing that fits right now. You're on top of things!</Muted>}
            {mission.tasks.map((t) => (
              <TaskRow key={t.id} task={t} />
            ))}
          </View>
        )}
      </Card>

      {lowSupplies.length > 0 && (
        <Card>
          <Title>🛒 Running low</Title>
          <Muted>{lowSupplies.map((s) => s.name).join(', ')}</Muted>
          <View style={{ height: 8 }} />
          <Button label="Open supplies" variant="secondary" onPress={() => router.navigate('/chores/supplies')} />
        </Card>
      )}
    </ScrollView>
  );
}
