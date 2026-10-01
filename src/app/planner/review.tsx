import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Card, ChipRow, colors, Muted, styles, Title } from '../../shared/ui';
import { fromDateKey, toDateKey } from '../../shared/dates';
import { addDays, periodReview, planWeek, prettyDay, time, weekStart, weekSummaryLine, type PeriodReview } from '../../modules/planner/lib/planner';
import { useStore } from '../../modules/planner/lib/store';

type Mode = 'week' | 'month' | 'next';
const MODES: { value: Mode; label: string }[] = [
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'next', label: 'Plan next week' },
];

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={{ flexBasis: '45%', flexGrow: 1, padding: 12, borderRadius: 12, backgroundColor: colors.primarySoft }}>
      <Text style={{ fontSize: 22, fontWeight: '700', color: colors.primary }}>{value}</Text>
      <Muted>{label}</Muted>
    </View>
  );
}

function ReviewCard({ title, r, previous }: { title: string; r: PeriodReview; previous: PeriodReview }) {
  const diff = Math.round((r.busyHours - previous.busyHours) * 10) / 10;
  return (
    <Card>
      <Title>{title}</Title>
      <View style={[styles.row, { gap: 8 }]}>
        <Stat label="events" value={r.events} />
        <Stat label="hours in meetings & plans" value={r.busyHours} />
        <Stat label="to-dos done" value={r.todosDone} />
        <Stat label="life admin done" value={r.adminDone} />
      </View>
      <View style={{ height: 10 }} />
      {r.busiestDay && (
        <Text style={styles.text}>
          📈 Busiest: {fromDateKey(r.busiestDay.date).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })} (
          {r.busiestDay.hours} h)
        </Text>
      )}
      {previous.busyHours > 0 && Math.abs(diff) >= 1 && (
        <Text style={styles.text}>
          {diff > 0 ? `⏫ ${diff} h busier than the period before.` : `⏬ ${-diff} h calmer than the period before.`}
        </Text>
      )}
      {previous.todosDone > 0 && (
        <Text style={styles.text}>
          {r.todosDone >= previous.todosDone ? '🏆' : '🙂'} {r.todosDone} to-dos done vs {previous.todosDone} before.
        </Text>
      )}
      <Text style={styles.text}>📝 {r.todosOpen} to-do{r.todosOpen === 1 ? '' : 's'} still open.</Text>
    </Card>
  );
}

export default function Review() {
  const { events, state, briefingInput } = useStore();
  const [mode, setMode] = useState<Mode>('week');
  const today = toDateKey();
  const { dayStart, dayEnd } = state.settings;

  const content = useMemo(() => {
    if (mode === 'week') {
      const from = weekStart(today);
      return {
        r: periodReview(events, state.todos, state.admin, from, addDays(from, 6), dayStart, dayEnd),
        previous: periodReview(events, state.todos, state.admin, addDays(from, -7), addDays(from, -1), dayStart, dayEnd),
      };
    }
    if (mode === 'month') {
      const t = fromDateKey(today);
      const from = toDateKey(new Date(t.getFullYear(), t.getMonth(), 1));
      const to = toDateKey(new Date(t.getFullYear(), t.getMonth() + 1, 0));
      const pFrom = toDateKey(new Date(t.getFullYear(), t.getMonth() - 1, 1));
      const pTo = toDateKey(new Date(t.getFullYear(), t.getMonth(), 0));
      return {
        r: periodReview(events, state.todos, state.admin, from, to, dayStart, dayEnd),
        previous: periodReview(events, state.todos, state.admin, pFrom, pTo, dayStart, dayEnd),
      };
    }
    return null;
  }, [mode, events, state.todos, state.admin, today, dayStart, dayEnd]);

  const next = useMemo(() => planWeek(briefingInput, addDays(weekStart(today), 7)), [briefingInput, today]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <ChipRow options={MODES} value={mode} onChange={setMode} />
      {content && (
        <ReviewCard
          title={mode === 'week' ? 'Your week' : fromDateKey(today).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
          r={content.r}
          previous={content.previous}
        />
      )}
      {mode === 'next' && (
        <>
          <Card>
            <Title>Next week</Title>
            <Text style={styles.text}>{weekSummaryLine(next)}</Text>
            <Muted>Open to-dos are placed on the days with the most free time, before their due date.</Muted>
          </Card>
          {next.map((d) => (
            <Card key={d.date}>
              <View style={styles.progressHeader}>
                <Text style={styles.label}>{prettyDay(d.date, today)}</Text>
                <Text style={{ color: d.load === 'busy' ? colors.warn : d.load === 'moderate' ? colors.muted : colors.primary }}>
                  {d.load === 'busy' ? '🔴 Busy' : d.load === 'moderate' ? '🟡 Moderate' : '🟢 Light'}
                </Text>
              </View>
              <Muted>
                {Math.round((d.busyMinutes / 60) * 10) / 10} h booked · {Math.round((d.freeMinutes / 60) * 10) / 10} h free
              </Muted>
              {d.events.map((e) => (
                <Text key={e.id} style={[styles.text, { marginTop: 4 }]}>
                  {e.allDay ? '📌' : time(e.start)} {e.title}
                </Text>
              ))}
              {d.notes.map((n) => (
                <Text key={n} style={[styles.text, { marginTop: 4 }]}>
                  {n}
                </Text>
              ))}
              {d.todos.map((t) => (
                <Text key={t.id} style={[styles.text, { marginTop: 4, color: colors.primary }]}>
                  ✅ {t.title}
                  {t.minutes ? ` (${t.minutes} min)` : ''}
                </Text>
              ))}
            </Card>
          ))}
        </>
      )}
    </ScrollView>
  );
}
