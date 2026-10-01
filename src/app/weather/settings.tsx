import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { PLACE_EMOJI } from '../../modules/weather/components/PlacePicker';
import { Button, Card, ChipRow, colors, Field, Muted, styles, Title } from '../../shared/ui';
import { notificationsSupported } from '../../modules/weather/lib/notifications';
import { getHaToken, setHaToken } from '../../modules/weather/lib/storage';
import { useStore } from '../../modules/weather/lib/store';
import type { PlaceKind } from '../../modules/weather/lib/types';
import { searchPlaces, type PlaceResult } from '../../modules/weather/lib/weather';

const KINDS: { value: PlaceKind; label: string }[] = [
  { value: 'home', label: '🏠 Home' },
  { value: 'work', label: '💼 Work' },
  { value: 'gym', label: '🏋️ Gym' },
  { value: 'other', label: '📍 Other' },
];
const pad = (n: number) => String(n).padStart(2, '0');

function PlacesCard() {
  const { state, addPlace, removePlace } = useStore();
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<PlaceKind>('home');
  const [results, setResults] = useState<PlaceResult[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  return (
    <Card>
      <Title>📍 Places</Title>
      <Muted>Save home, work and the gym to check the weather where you're going.</Muted>
      {state.places.map((p) => (
        <View key={p.id} style={styles.listItem}>
          <Text style={[styles.text, { flex: 1 }]}>
            {PLACE_EMOJI[p.kind]} {p.name}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${p.name}`} onPress={() => removePlace(p.id)} hitSlop={8}>
            <Text style={{ color: colors.danger, fontSize: 16 }}>✕</Text>
          </Pressable>
        </View>
      ))}
      <View style={{ height: 10 }} />
      <ChipRow options={KINDS} value={kind} onChange={setKind} />
      <View style={{ height: 10 }} />
      <View style={[styles.row, { alignItems: 'flex-end' }]}>
        <View style={{ flex: 1 }}>
          <Field label="Town or city" value={query} onChangeText={setQuery} placeholder="e.g. Thessaloniki" returnKeyType="search" />
        </View>
        <View style={{ marginBottom: 12 }}>
          <Button
            label="Search"
            variant="secondary"
            disabled={query.trim().length < 2 || busy}
            onPress={async () => {
              setBusy(true);
              setError('');
              try {
                setResults(await searchPlaces(query));
              } catch {
                setError('Search failed. Check your internet.');
              } finally {
                setBusy(false);
              }
            }}
          />
        </View>
      </View>
      {busy && <ActivityIndicator color={colors.primary} />}
      {!!error && <Text style={{ color: colors.danger }}>{error}</Text>}
      {results?.length === 0 && <Muted>No places found.</Muted>}
      {results?.map((r) => (
        <Pressable
          key={`${r.lat},${r.lon}`}
          accessibilityRole="button"
          onPress={() => {
            addPlace({ name: r.name, kind, lat: r.lat, lon: r.lon });
            setResults(null);
            setQuery('');
          }}
          style={styles.listItem}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.text}>{r.name}</Text>
            <Muted>{r.detail}</Muted>
          </View>
          <Text style={{ color: colors.primary }}>+ Add</Text>
        </Pressable>
      ))}
    </Card>
  );
}

function NotificationsCard() {
  const { state, setSettings } = useStore();
  const s = state.settings;
  const [at, setAt] = useState(`${pad(s.morningHour)}:${pad(s.morningMinute)}`);
  const [low, setLow] = useState(String(s.humidityLow));
  const [high, setHigh] = useState(String(s.humidityHigh));
  const [saved, setSaved] = useState('');
  const m = at.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  const lo = Number(low);
  const hi = Number(high);
  const valid = !!m && Number.isInteger(lo) && Number.isInteger(hi) && lo >= 10 && hi <= 90 && hi > lo;

  return (
    <Card>
      <Title>🔔 Notifications</Title>
      {!notificationsSupported && <Muted>Notifications only work in the app on your phone.</Muted>}
      <View style={[styles.progressHeader, { alignItems: 'center', marginVertical: 4 }]}>
        <Text style={styles.text}>Morning “what to wear”</Text>
        <Switch value={s.morningEnabled} onValueChange={(v) => setSettings({ ...s, morningEnabled: v })} />
      </View>
      <View style={[styles.progressHeader, { alignItems: 'center', marginVertical: 4 }]}>
        <Text style={styles.text}>Indoor humidity alerts</Text>
        <Switch value={s.indoorAlerts} onValueChange={(v) => setSettings({ ...s, indoorAlerts: v })} />
      </View>
      <View style={{ height: 8 }} />
      <Field label="Morning time (HH:MM)" value={at} onChangeText={setAt} placeholder="07:00" />
      <Text style={styles.label}>Comfortable humidity</Text>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Field label="Low (%)" value={low} onChangeText={setLow} keyboardType="number-pad" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="High (%)" value={high} onChangeText={setHigh} keyboardType="number-pad" />
        </View>
      </View>
      <Button
        label="Save"
        disabled={!valid}
        onPress={() => {
          if (!m) return;
          setSettings({ ...s, morningHour: Number(m[1]), morningMinute: Number(m[2]), humidityLow: lo, humidityHigh: hi });
          setSaved('Saved ✓');
          setTimeout(() => setSaved(''), 2000);
        }}
      />
      {!!saved && <Text style={{ color: colors.primary, marginTop: 8 }}>{saved}</Text>}
    </Card>
  );
}

function HomeAssistantCard() {
  const { state, setSettings, refreshIndoor } = useStore();
  const ha = state.settings.ha;
  const [url, setUrl] = useState(ha.url);
  const [humidity, setHumidity] = useState(ha.humidityEntity);
  const [temperature, setTemperature] = useState(ha.temperatureEntity);
  const [humidifier, setHumidifier] = useState(ha.humidifierEntity);
  const [token, setToken] = useState('');
  const [hasToken, setHasToken] = useState(false);
  const [status, setStatus] = useState('');
  useEffect(() => {
    getHaToken().then((t) => setHasToken(!!t));
  }, []);
  const urlOk = !url.trim() || /^https?:\/\/\S+$/.test(url.trim());

  return (
    <Card>
      <Title>🏡 Home Assistant</Title>
      <Muted>
        Connect your humidity/temperature sensor and humidifier through Home Assistant. Create a long-lived access token
        under your HA profile → Security. The token is stored only on this device{hasToken ? ', and one is saved now' : ''}.
      </Muted>
      <View style={{ height: 8 }} />
      <Field label="Home Assistant URL" value={url} onChangeText={setUrl} placeholder="http://homeassistant.local:8123" autoCapitalize="none" keyboardType="url" />
      <Field label="Access token" value={token} onChangeText={setToken} placeholder={hasToken ? '•••••• (saved)' : 'paste token'} secureTextEntry autoCapitalize="none" />
      <Field label="Humidity sensor entity" value={humidity} onChangeText={setHumidity} placeholder="sensor.living_room_humidity" autoCapitalize="none" />
      <Field label="Temperature sensor entity" value={temperature} onChangeText={setTemperature} placeholder="sensor.living_room_temperature" autoCapitalize="none" />
      <Field label="Humidifier entity (optional)" value={humidifier} onChangeText={setHumidifier} placeholder="humidifier.bedroom or switch.humidifier" autoCapitalize="none" />
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Button
            label="Save & test"
            disabled={!urlOk}
            onPress={async () => {
              if (token.trim()) {
                await setHaToken(token.trim());
                setToken('');
                setHasToken(true);
              }
              setSettings({
                ...state.settings,
                ha: { url: url.trim(), humidityEntity: humidity.trim(), temperatureEntity: temperature.trim(), humidifierEntity: humidifier.trim() },
              });
              setStatus('Testing…');
              // Settings are committed synchronously, so the test uses the new values.
              setStatus((await refreshIndoor()) ?? 'Connected ✓ Sensor read successfully.');
            }}
          />
        </View>
        {hasToken && (
          <View style={{ flex: 1 }}>
            <Button
              label="Remove token"
              variant="secondary"
              onPress={async () => {
                await setHaToken('');
                setHasToken(false);
                setStatus('Token removed');
              }}
            />
          </View>
        )}
      </View>
      {!!status && <Muted>{status}</Muted>}
      <Muted>No Home Assistant? Type readings from any hygrometer in the Indoor tab.</Muted>
    </Card>
  );
}

export default function Settings() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <PlacesCard />
      <NotificationsCard />
      <HomeAssistantCard />
    </ScrollView>
  );
}
