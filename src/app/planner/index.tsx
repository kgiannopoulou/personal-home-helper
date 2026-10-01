import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Button, Card, colors, Muted, styles, Title } from '../../shared/ui';
import { calendarSupported } from '../../modules/planner/lib/calendar';
import { toDateKey } from '../../shared/dates';
import { adminDueText, fitTodos, morningBriefing, time } from '../../modules/planner/lib/planner';
import { useStore } from '../../modules/planner/lib/store';

function useNow(): Date {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export default function Today() {
  const { state, briefingInput, toggleTodo, completeAdminItem, toggleTripCheck, calendarError } = useStore();
  const router = useRouter();
  const now = useNow();
  const today = toDateKey(now);
  const b = useMemo(() => morningBriefing(briefingInput, today, now), [briefingInput, today, now]);
  const fits = fitTodos(b.todos.length ? b.todos : state.todos, b.gaps).slice(0, 3);
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const timed = b.events.filter((e) => !e.allDay);
  const allDay = b.events.filter((e) => e.allDay);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card>
        <View style={styles.progressHeader}>
          <Title>{greeting} 👋</Title>
          <Pressable accessibilityRole="button" accessibilityLabel="Settings" onPress={() => router.navigate('/planner/settings')} hitSlop={10}>
            <Text style={{ fontSize: 20 }}>⚙️</Text>
          </Pressable>
        </View>
        <Muted>
          {now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })} ·{' '}
          {b.busyMinutes >= 360 ? 'a busy day' : b.busyMinutes >= 180 ? 'a steady day' : 'a light day'}
          {timed.length ? ` with ${timed.length} event${timed.length > 1 ? 's' : ''}` : ''}.
        </Muted>
        {allDay.map((e) => (
          <Text key={e.id} style={[styles.text, { marginTop: 6 }]}>
            📌 {e.title}
          </Text>
        ))}
      </Card>

      {!!calendarError && (
        <Card style={{ backgroundColor: colors.warnSoft }}>
          <Muted>{calendarError}</Muted>
        </Card>
      )}

      <Card>
        <Title>📅 Schedule</Title>
        {timed.length === 0 && (
          <Muted>{calendarSupported ? 'Nothing in your calendar today.' : 'No events today. Add some in the Calendar tab.'}</Muted>
        )}
        {timed.map((e) => {
          const past = new Date(e.end) < now;
          return (
            <View key={e.id} style={[styles.listItem, past && { opacity: 0.5 }]}>
              <Text style={[styles.label, { width: 96 }]}>
                {time(e.start)}–{time(e.end)}
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.text}>{e.title}</Text>
                {!!e.location && <Muted>📍 {e.location}</Muted>}
              </View>
            </View>
          );
        })}
        {b.gaps.length > 0 && (
          <Muted>
            🟢 Free: {b.gaps.map((g) => `${time(g.start)}–${time(g.end)}`).join(', ')}
          </Muted>
        )}
      </Card>

      {(b.todos.length > 0 || fits.length > 0) && (
        <Card>
          <Title>✅ To-do</Title>
          {b.todos.map((t) => (
            <Pressable key={t.id} accessibilityRole="checkbox" onPress={() => toggleTodo(t.id)} style={styles.listItem}>
              <Text style={{ fontSize: 18 }}>⬜</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.text}>{t.title}</Text>
                <Muted>{t.due && t.due < today ? '⚠️ overdue' : 'today'}{t.minutes ? ` · ${t.minutes} min` : ''}</Muted>
              </View>
            </Pressable>
          ))}
          {fits.length > 0 && (
            <Muted>
              💡 {fits.map((f) => `${f.todo.title} fits at ${time(f.gap.start)}`).join(' · ')}
            </Muted>
          )}
        </Card>
      )}

      {b.admin.length > 0 && (
        <Card>
          <Title>📋 Life admin</Title>
          {b.admin.map((a) => (
            <View key={a.id} style={styles.listItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.text}>{a.title}</Text>
                <Muted>
                  {adminDueText(a, today)}
                  {a.amount ? ` · ${state.settings.currency}${a.amount}` : ''}
                </Muted>
              </View>
              <Pressable accessibilityRole="button" onPress={() => completeAdminItem(a.id)} hitSlop={8}>
                <Text style={{ color: colors.primary, fontWeight: '700' }}>Done</Text>
              </Pressable>
            </View>
          ))}
        </Card>
      )}

      {b.birthdays.map(({ person, daysUntil, turning }) => (
        <Card key={person.id} style={{ backgroundColor: colors.primarySoft }}>
          <Text style={styles.text}>
            🎂{' '}
            {daysUntil === 0
              ? `It's ${person.name}'s birthday today!`
              : `${person.name}'s birthday is in ${daysUntil} day${daysUntil === 1 ? '' : 's'}${turning ? ` (turning ${turning})` : ''}.`}
          </Text>
          {daysUntil > 0 && (
            <>
              <View style={{ height: 8 }} />
              <Button label={person.ideas.length ? 'See gift ideas' : 'Get gift ideas'} variant="secondary" onPress={() => router.navigate('/planner/life')} />
            </>
          )}
        </Card>
      ))}

      {b.trips.map(({ trip, daysUntil, tasks }) => (
        <Card key={trip.key}>
          <Title>
            🧳 {trip.destination} {daysUntil === 0 ? 'today!' : `in ${daysUntil} day${daysUntil === 1 ? '' : 's'}`}
          </Title>
          {tasks.length === 0 && <Muted>You're all set for now ✓</Muted>}
          {tasks.map((t) => (
            <Pressable key={t.id} accessibilityRole="checkbox" onPress={() => toggleTripCheck(trip.key, t.id)} style={styles.listItem}>
              <Text style={{ fontSize: 18 }}>⬜</Text>
              <Text style={[styles.text, { flex: 1 }]}>{t.label}</Text>
            </Pressable>
          ))}
        </Card>
      ))}
    </ScrollView>
  );
}
