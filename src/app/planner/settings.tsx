import { useEffect, useState } from 'react';
import { ScrollView, Switch, Text, View } from 'react-native';
import { Button, Card, Chip, ChipRow, colors, Field, Muted, styles, Title } from '../../shared/ui';
import { calendarSupported, listCalendars, type PhoneCalendar } from '../../modules/planner/lib/calendar';
import { notificationsSupported } from '../../modules/planner/lib/notifications';
import { getApiKey, setApiKey } from '../../modules/planner/lib/storage';
import { useStore } from '../../modules/planner/lib/store';

const pad = (n: number) => String(n).padStart(2, '0');

function BriefingCard() {
  const { state, setSettings } = useStore();
  const s = state.settings;
  const [at, setAt] = useState(`${pad(s.briefingHour)}:${pad(s.briefingMinute)}`);
  const [wake, setWake] = useState(String(s.dayStart));
  const [sleep, setSleep] = useState(String(s.dayEnd));
  const [saved, setSaved] = useState('');
  const m = at.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  const w = Number(wake);
  const sl = Number(sleep);
  const valid = !!m && Number.isInteger(w) && Number.isInteger(sl) && w >= 0 && sl <= 24 && sl > w;

  return (
    <Card>
      <Title>☀️ Morning briefing</Title>
      <View style={[styles.progressHeader, { alignItems: 'center' }]}>
        <Text style={styles.text}>Daily notification</Text>
        <Switch value={s.briefingEnabled} onValueChange={(v) => setSettings({ ...s, briefingEnabled: v })} />
      </View>
      {!notificationsSupported && <Muted>Notifications only work in the app on your phone.</Muted>}
      <View style={{ height: 10 }} />
      <Field label="Time (HH:MM)" value={at} onChangeText={setAt} placeholder="07:30" />
      <Text style={styles.label}>Waking hours (used to find free time)</Text>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Field label="From (hour)" value={wake} onChangeText={setWake} keyboardType="number-pad" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Until (hour)" value={sleep} onChangeText={setSleep} keyboardType="number-pad" />
        </View>
      </View>
      <Text style={styles.label}>Currency</Text>
      <ChipRow
        value={s.currency}
        onChange={(currency) => setSettings({ ...s, currency })}
        options={['€', '£', '$', 'kr ', 'CHF '].map((v) => ({ value: v, label: v.trim() }))}
      />
      <View style={{ height: 12 }} />
      <Button
        label="Save"
        disabled={!valid}
        onPress={() => {
          if (!m) return;
          setSettings({ ...s, briefingHour: Number(m[1]), briefingMinute: Number(m[2]), dayStart: w, dayEnd: sl });
          setSaved('Saved ✓');
          setTimeout(() => setSaved(''), 2000);
        }}
      />
      {!!saved && <Text style={{ color: colors.primary, marginTop: 8 }}>{saved}</Text>}
    </Card>
  );
}

function CalendarsCard() {
  const { state, setSettings } = useStore();
  const [calendars, setCalendars] = useState<PhoneCalendar[] | null>(null);
  useEffect(() => {
    if (calendarSupported) listCalendars().then(setCalendars).catch(() => setCalendars([]));
  }, []);
  const ids = state.settings.calendarIds;
  const isOn = (id: string) => !ids || ids.includes(id);
  const toggle = (id: string) => {
    const all = (calendars ?? []).map((c) => c.id);
    const current = ids ?? all;
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    setSettings({ ...state.settings, calendarIds: next.length === all.length ? null : next });
  };

  return (
    <Card>
      <Title>📅 Calendars</Title>
      {!calendarSupported ? (
        <Muted>Open the app on your phone to connect your calendars.</Muted>
      ) : calendars === null ? (
        <Muted>Loading…</Muted>
      ) : calendars.length === 0 ? (
        <Muted>
          No calendars found, or permission was denied. Add your Google or Outlook account in your phone's settings, and allow
          calendar access for this app.
        </Muted>
      ) : (
        <>
          <Muted>Google and Outlook calendars appear here once their account is added on your phone.</Muted>
          <View style={[styles.row, { marginTop: 8 }]}>
            {calendars.map((c) => (
              <Chip key={c.id} label={`${c.title}${c.account && c.account !== c.title ? ` · ${c.account}` : ''}`} selected={isOn(c.id)} onPress={() => toggle(c.id)} />
            ))}
          </View>
        </>
      )}
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
      <Title>✨ AI gift ideas</Title>
      <Muted>
        Gift ideas use Claude. Paste your own Anthropic API key (console.anthropic.com). It's stored only on this device
        {hasKey ? ', and one is saved now' : ''}.
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

export default function Settings() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <BriefingCard />
      <CalendarsCard />
      <ApiKeyCard />
    </ScrollView>
  );
}
