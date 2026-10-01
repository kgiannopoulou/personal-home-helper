import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { DateField, isDateKey } from '../../modules/planner/components/DateField';
import { Button, Card, Chip, colors, Field, Muted, styles, Title } from '../../shared/ui';
import { calendarSupported } from '../../modules/planner/lib/calendar';
import { fromDateKey, toDateKey } from '../../shared/dates';
import { addDays, busyMinutes, eventsOn, prettyDay, time, weekStart } from '../../modules/planner/lib/planner';
import { useStore } from '../../modules/planner/lib/store';

const isTime = (v: string) => /^([01]?\d|2[0-3]):[0-5]\d$/.test(v);

function AddEvent() {
  const { addEvent } = useStore();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(toDateKey());
  const [endDate, setEndDate] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [from, setFrom] = useState('09:00');
  const [to, setTo] = useState('10:00');
  const [location, setLocation] = useState('');
  const end = endDate || date;
  const valid =
    !!title.trim() && isDateKey(date) && (!endDate || (isDateKey(endDate) && endDate >= date)) && (allDay || (isTime(from) && isTime(to) && (end > date || to > from)));

  return (
    <Card>
      <Title>Add an event</Title>
      <Field label="What" value={title} onChangeText={setTitle} placeholder="e.g. Dentist, ✈️ London, Mom's birthday" />
      <DateField label="Date" value={date} onChange={setDate} />
      <View style={styles.row}>
        <Chip label="⏰ At a time" selected={!allDay} onPress={() => setAllDay(false)} />
        <Chip label="📌 All day" selected={allDay} onPress={() => setAllDay(true)} />
      </View>
      <View style={{ height: 10 }} />
      {!allDay && (
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Field label="From" value={from} onChangeText={setFrom} placeholder="09:00" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="To" value={to} onChangeText={setTo} placeholder="10:00" />
          </View>
        </View>
      )}
      <Field label="Until (for trips, optional)" value={endDate} onChangeText={setEndDate} placeholder="YYYY-MM-DD" autoCapitalize="none" />
      <Field label="Where (optional)" value={location} onChangeText={setLocation} />
      <Button
        label="Add"
        disabled={!valid}
        onPress={() => {
          const [y, m, d] = date.split('-').map(Number);
          const [ey, em, ed] = end.split('-').map(Number);
          const at = (yy: number, mm: number, dd: number, t: string) => {
            const [h, min] = t.split(':').map(Number);
            return new Date(yy, mm - 1, dd, h, min).toISOString();
          };
          addEvent({
            title: title.trim(),
            allDay,
            start: allDay ? new Date(y, m - 1, d).toISOString() : at(y, m, d, from),
            end: allDay ? new Date(ey, em - 1, ed + 1).toISOString() : at(ey, em, ed, to),
            location: location.trim() || undefined,
          });
          setTitle('');
          setEndDate('');
          setLocation('');
        }}
      />
    </Card>
  );
}

export default function CalendarScreen() {
  const { events, state, removeEvent, refreshCalendar } = useStore();
  const today = toDateKey();
  const [week, setWeek] = useState(weekStart(today));
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const { dayStart, dayEnd } = state.settings;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Card>
        <View style={[styles.progressHeader, { alignItems: 'center' }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Previous week" onPress={() => setWeek(addDays(week, -7))} hitSlop={10}>
            <Text style={{ fontSize: 22, color: colors.primary }}>‹</Text>
          </Pressable>
          <Text style={styles.label}>
            {fromDateKey(week).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} –{' '}
            {fromDateKey(addDays(week, 6)).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Next week" onPress={() => setWeek(addDays(week, 7))} hitSlop={10}>
            <Text style={{ fontSize: 22, color: colors.primary }}>›</Text>
          </Pressable>
        </View>
        <Muted>
          {calendarSupported
            ? 'Shows the calendars on your phone (Google, Outlook, iCloud). Choose which ones in ⚙️ Settings.'
            : 'Phone calendars only work in the app on your phone. Here you can add events by hand.'}
        </Muted>
        {calendarSupported && (
          <Pressable accessibilityRole="button" onPress={refreshCalendar} style={{ marginTop: 6 }}>
            <Text style={{ color: colors.primary }}>↻ Refresh</Text>
          </Pressable>
        )}
      </Card>

      {days.map((d) => {
        const list = eventsOn(events, d);
        const busy = busyMinutes(events, d, dayStart, dayEnd);
        return (
          <Card key={d} style={d === today ? { borderColor: colors.primary } : undefined}>
            <View style={styles.progressHeader}>
              <Text style={styles.label}>{prettyDay(d, today)}</Text>
              <Muted>{busy ? `${Math.round((busy / 60) * 10) / 10} h busy` : 'free'}</Muted>
            </View>
            {list.length === 0 && <Muted>—</Muted>}
            {list.map((e) => (
              <View key={e.id} style={styles.listItem}>
                <Text style={[styles.muted, { width: 52 }]}>{e.allDay ? 'all day' : time(e.start)}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.text}>{e.title}</Text>
                  <Muted>{[e.location, e.calendarName].filter(Boolean).join(' · ')}</Muted>
                </View>
                {e.source === 'manual' && (
                  <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${e.title}`} onPress={() => removeEvent(e.id)} hitSlop={8}>
                    <Text style={{ color: colors.danger, fontSize: 16 }}>✕</Text>
                  </Pressable>
                )}
              </View>
            ))}
          </Card>
        );
      })}

      <AddEvent />
    </ScrollView>
  );
}
