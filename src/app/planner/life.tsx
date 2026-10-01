import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { DateField, isDateKey } from '../../modules/planner/components/DateField';
import { Button, Card, Chip, ChipRow, colors, Field, Muted, styles, Title } from '../../shared/ui';
import { toDateKey } from '../../shared/dates';
import { GiftAIError, suggestGifts } from '../../modules/planner/lib/giftAI';
import {
  ADMIN_LABEL,
  adminDueText,
  birthdaysFromEvents,
  daysBetween,
  detectTrips,
  nextBirthday,
  prettyDay,
  quickGiftIdeas,
  tripChecklist,
} from '../../modules/planner/lib/planner';
import { getApiKey } from '../../modules/planner/lib/storage';
import { useStore } from '../../modules/planner/lib/store';
import type { AdminKind, Person } from '../../modules/planner/lib/types';

const TEMPLATES: { title: string; kind: AdminKind; repeatMonths: number; remindDays: number }[] = [
  { title: 'Pay rent', kind: 'bill', repeatMonths: 1, remindDays: 3 },
  { title: 'Pay electricity bill', kind: 'bill', repeatMonths: 1, remindDays: 5 },
  { title: 'Book dentist', kind: 'appointment', repeatMonths: 6, remindDays: 14 },
  { title: 'Car service', kind: 'appointment', repeatMonths: 12, remindDays: 21 },
  { title: 'Renew insurance', kind: 'renewal', repeatMonths: 12, remindDays: 30 },
  { title: 'Renew passport', kind: 'renewal', repeatMonths: 0, remindDays: 90 },
  { title: 'Review subscriptions', kind: 'other', repeatMonths: 3, remindDays: 3 },
  { title: 'Return package', kind: 'other', repeatMonths: 0, remindDays: 2 },
];
const REPEATS = [
  { value: '0', label: 'Once' },
  { value: '1', label: 'Monthly' },
  { value: '3', label: 'Every 3 months' },
  { value: '6', label: 'Every 6 months' },
  { value: '12', label: 'Yearly' },
];
const KINDS = (Object.keys(ADMIN_LABEL) as AdminKind[]).map((k) => ({ value: k, label: ADMIN_LABEL[k] }));

function AdminCard() {
  const { state, addAdmin, completeAdminItem, removeAdmin } = useStore();
  const today = toDateKey();
  const items = [...state.admin].filter((a) => !a.done).sort((a, b) => a.due.localeCompare(b.due));
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<AdminKind>('bill');
  const [due, setDue] = useState(today);
  const [repeat, setRepeat] = useState('1');
  const [remind, setRemind] = useState('7');
  const [amount, setAmount] = useState('');
  const r = Number(remind);
  const amt = amount ? Number(amount.replace(',', '.')) : undefined;

  return (
    <Card>
      <Title>📋 Life admin</Title>
      <Muted>Bills, appointments and renewals. You're reminded in your morning briefing as the date gets close.</Muted>
      {items.map((a) => {
        const d = daysBetween(today, a.due);
        return (
          <View key={a.id} style={styles.listItem}>
            <View style={{ flex: 1 }}>
              <Text style={styles.text}>
                {ADMIN_LABEL[a.kind].split(' ')[0]} {a.title}
              </Text>
              <Muted>
                <Text style={d < 0 ? { color: colors.warn } : undefined}>{adminDueText(a, today)}</Text> · {prettyDay(a.due, today)}
                {a.repeatMonths ? ` · ${REPEATS.find((x) => x.value === String(a.repeatMonths))?.label.toLowerCase() ?? `every ${a.repeatMonths} months`}` : ''}
                {a.amount ? ` · ${state.settings.currency}${a.amount}` : ''}
              </Muted>
            </View>
            <Pressable accessibilityRole="button" onPress={() => completeAdminItem(a.id)} hitSlop={8}>
              <Text style={{ color: colors.primary, fontWeight: '700' }}>Done</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${a.title}`} onPress={() => removeAdmin(a.id)} hitSlop={8}>
              <Text style={{ color: colors.muted }}>✕</Text>
            </Pressable>
          </View>
        );
      })}
      <View style={{ height: 10 }} />
      {!adding ? (
        <Button label="+ Add life admin" variant="secondary" onPress={() => setAdding(true)} />
      ) : (
        <View>
          <View style={styles.row}>
            {TEMPLATES.map((t) => (
              <Chip
                key={t.title}
                label={t.title}
                selected={title === t.title}
                onPress={() => {
                  setTitle(t.title);
                  setKind(t.kind);
                  setRepeat(String(t.repeatMonths));
                  setRemind(String(t.remindDays));
                }}
              />
            ))}
          </View>
          <View style={{ height: 10 }} />
          <Field label="What" value={title} onChangeText={setTitle} />
          <ChipRow options={KINDS} value={kind} onChange={setKind} />
          <View style={{ height: 10 }} />
          <DateField label="Due" value={due} onChange={setDue} />
          <ChipRow options={REPEATS} value={repeat} onChange={setRepeat} />
          <View style={{ height: 10 }} />
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Field label="Remind me (days before)" value={remind} onChangeText={setRemind} keyboardType="number-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label={`Amount (${state.settings.currency.trim()}, optional)`} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
            </View>
          </View>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Button
                label="Save"
                disabled={!title.trim() || !isDateKey(due) || !(Number.isInteger(r) && r >= 0 && r <= 365) || (amt !== undefined && !(amt > 0))}
                onPress={() => {
                  addAdmin({ title: title.trim(), kind, due, repeatMonths: Number(repeat), remindDays: r, amount: amt });
                  setTitle('');
                  setAmount('');
                  setAdding(false);
                }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button label="Cancel" variant="secondary" onPress={() => setAdding(false)} />
            </View>
          </View>
        </View>
      )}
    </Card>
  );
}

function PersonRow({ person }: { person: Person }) {
  const { state, updatePerson, removePerson } = useStore();
  const today = toDateKey();
  const next = nextBirthday(person, today);
  const [open, setOpen] = useState(false);
  const [interests, setInterests] = useState(person.interests);
  const [budget, setBudget] = useState(person.budget ? String(person.budget) : '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasKey, setHasKey] = useState(false);
  useEffect(() => {
    if (open) getApiKey().then((k) => setHasKey(!!k));
  }, [open]);

  const save = () => {
    const b = Number(budget.replace(',', '.'));
    updatePerson(person.id, { interests: interests.trim(), budget: b > 0 ? b : undefined });
  };

  return (
    <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <Pressable accessibilityRole="button" onPress={() => setOpen(!open)} style={styles.progressHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.text}>🎂 {person.name}</Text>
          <Muted>
            {prettyDay(next.date, today)} · {next.daysUntil === 0 ? 'today!' : `in ${next.daysUntil} days`}
            {next.turning ? ` · turning ${next.turning}` : ''}
          </Muted>
        </View>
        <Text style={{ color: colors.primary }}>{open ? '▲' : '🎁'}</Text>
      </Pressable>
      {open && (
        <View style={{ marginTop: 10 }}>
          <Field label="What do they like?" value={interests} onChangeText={setInterests} onBlur={save} placeholder="She likes cooking and gardening" />
          <Field label={`Gift budget (${state.settings.currency.trim()}, optional)`} value={budget} onChangeText={setBudget} onBlur={save} keyboardType="decimal-pad" />
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Button
                label="Quick ideas"
                variant="secondary"
                onPress={() => {
                  save();
                  updatePerson(person.id, { ideas: quickGiftIdeas(interests) });
                }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label={loading ? 'Thinking…' : '✨ AI ideas'}
                disabled={loading || !hasKey}
                onPress={async () => {
                  save();
                  setLoading(true);
                  setError('');
                  try {
                    const key = await getApiKey();
                    if (!key) throw new GiftAIError('Add your Anthropic API key in ⚙️ Settings first.');
                    const b = Number(budget.replace(',', '.'));
                    const ideas = await suggestGifts(
                      key,
                      { name: person.name, interests, budget: b > 0 ? b : undefined, turning: next.turning },
                      state.settings.currency,
                    );
                    updatePerson(person.id, { ideas });
                  } catch (e) {
                    setError(e instanceof GiftAIError ? e.message : 'Something went wrong. Please try again.');
                  } finally {
                    setLoading(false);
                  }
                }}
              />
            </View>
          </View>
          {!hasKey && <Muted>AI ideas need your Anthropic API key in ⚙️ Settings.</Muted>}
          {loading && <ActivityIndicator style={{ marginTop: 8 }} color={colors.primary} />}
          {!!error && <Text style={{ color: colors.danger, marginTop: 6 }}>{error}</Text>}
          {person.ideas.map((idea) => (
            <Text key={idea} style={[styles.text, { marginTop: 6 }]}>
              🎁 {idea}
            </Text>
          ))}
          <Pressable accessibilityRole="button" onPress={() => removePerson(person.id)} style={{ marginTop: 10 }}>
            <Text style={{ color: colors.danger, textAlign: 'right' }}>Remove {person.name}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function BirthdaysCard() {
  const { state, events, addPerson } = useStore();
  const today = toDateKey();
  const people = [...state.people].sort((a, b) => nextBirthday(a, today).daysUntil - nextBirthday(b, today).daysUntil);
  const fromCalendar = useMemo(() => {
    const known = new Set(state.people.map((p) => p.name.toLowerCase()));
    return birthdaysFromEvents(events).filter((b) => !known.has(b.name.toLowerCase()));
  }, [events, state.people]);
  const [name, setName] = useState('');
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const d = Number(day);
  const m = Number(month);
  const y = year ? Number(year) : undefined;
  const valid =
    !!name.trim() &&
    Number.isInteger(m) && m >= 1 && m <= 12 &&
    Number.isInteger(d) && d >= 1 && d <= new Date(2024, m, 0).getDate() &&
    (y === undefined || (Number.isInteger(y) && y > 1900 && y <= new Date().getFullYear()));

  return (
    <Card>
      <Title>🎂 Birthdays</Title>
      <Muted>You're reminded weeks ahead, with gift ideas based on what they like.</Muted>
      {people.map((p) => (
        <PersonRow key={p.id} person={p} />
      ))}
      {fromCalendar.length > 0 && (
        <View style={{ marginTop: 10 }}>
          <Text style={styles.label}>Found in your calendar</Text>
          <View style={styles.row}>
            {fromCalendar.map((b) => (
              <Chip key={b.name} label={`+ ${b.name} (${b.birthday})`} onPress={() => addPerson({ name: b.name, birthday: b.birthday, interests: '', remindDays: 21 })} />
            ))}
          </View>
        </View>
      )}
      <View style={{ height: 12 }} />
      <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Mom" />
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Field label="Day" value={day} onChangeText={setDay} keyboardType="number-pad" placeholder="12" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Month" value={month} onChangeText={setMonth} keyboardType="number-pad" placeholder="10" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Year (optional)" value={year} onChangeText={setYear} keyboardType="number-pad" />
        </View>
      </View>
      <Button
        label="Add birthday"
        variant="secondary"
        disabled={!valid}
        onPress={() => {
          addPerson({
            name: name.trim(),
            birthday: `${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
            year: y,
            interests: '',
            remindDays: 21,
          });
          setName('');
          setDay('');
          setMonth('');
          setYear('');
        }}
      />
    </Card>
  );
}

function TripsCard() {
  const { state, events, toggleTripCheck } = useStore();
  const today = toDateKey();
  const trips = useMemo(() => detectTrips(events, today, 60), [events, today]);

  return (
    <Card>
      <Title>🧳 Trips</Title>
      {trips.length === 0 && (
        <Muted>
          No trips in the next two months. Trips are found in your calendar from titles like “✈️ London” or “Trip to Rome”, or
          all-day events of 2+ days with a place.
        </Muted>
      )}
      {trips.map((trip) => {
        const checked = state.tripChecks[trip.key] ?? [];
        const until = daysBetween(today, trip.start);
        const list = tripChecklist(trip);
        return (
          <View key={trip.key} style={{ marginTop: 10 }}>
            <Text style={styles.label}>
              {trip.destination} · {prettyDay(trip.start, today)}
              {trip.nights ? ` · ${trip.nights} night${trip.nights > 1 ? 's' : ''}` : ''} · {until === 0 ? 'today' : `in ${until} days`}
            </Text>
            <Muted>
              {checked.length}/{list.length} ready
            </Muted>
            {list.map((t) => {
              const done = checked.includes(t.id);
              const now = until <= t.daysBefore;
              return (
                <Pressable key={t.id} accessibilityRole="checkbox" accessibilityState={{ checked: done }} onPress={() => toggleTripCheck(trip.key, t.id)} style={styles.listItem}>
                  <Text style={{ fontSize: 18 }}>{done ? '✅' : '⬜'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.text, done && { color: colors.muted, textDecorationLine: 'line-through' }]}>{t.label}</Text>
                    <Muted>{t.daysBefore === 0 ? 'On the day' : `${t.daysBefore} day${t.daysBefore > 1 ? 's' : ''} before`}{now && !done ? ' · now' : ''}</Muted>
                  </View>
                </Pressable>
              );
            })}
          </View>
        );
      })}
    </Card>
  );
}

export default function Life() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <AdminCard />
      <BirthdaysCard />
      <TripsCard />
    </ScrollView>
  );
}
