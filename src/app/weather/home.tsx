import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Button, Card, colors, Field, Muted, styles, Title } from '../../shared/ui';
import { HomeAssistantError, turnOn } from '../../modules/weather/lib/homeAssistant';
import { indoorAdvice, last24h, latest } from '../../modules/weather/lib/indoor';
import { getHaToken } from '../../modules/weather/lib/storage';
import { useStore } from '../../modules/weather/lib/store';

function Chart({ values, low, high, unit }: { values: (number | null)[]; low: number; high: number; unit: string }) {
  const present = values.filter((v): v is number => v !== null);
  if (present.length < 2) return <Muted>Not enough readings yet for a chart.</Muted>;
  const min = Math.min(...present, low) - 2;
  const max = Math.max(...present, high) + 2;
  const H = 90;
  const y = (v: number) => ((v - min) / (max - min)) * H;
  return (
    <View>
      <View style={{ height: H, flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
        <View
          pointerEvents="none"
          style={{ position: 'absolute', left: 0, right: 0, bottom: y(low), height: y(high) - y(low), backgroundColor: colors.primarySoft }}
        />
        {values.map((v, i) => (
          <View key={i} style={{ flex: 1, height: H, justifyContent: 'flex-end' }}>
            {v !== null && (
              <View style={{ height: Math.max(3, y(v)), borderRadius: 2, backgroundColor: v < low || v > high ? colors.warn : colors.primary }} />
            )}
          </View>
        ))}
      </View>
      <View style={styles.progressHeader}>
        <Muted>24 h ago</Muted>
        <Muted>
          shaded = {low}–{high}
          {unit}
        </Muted>
        <Muted>now</Muted>
      </View>
    </View>
  );
}

export default function Indoor() {
  const { state, refreshIndoor, addReading } = useStore();
  const { settings } = state;
  const now = latest(state.readings);
  const current = state.forecast?.current;
  const advice = indoorAdvice(now, settings, current ? { temp: current.temp, raining: current.code >= 51 } : undefined);
  const haReady = !!settings.ha.url && !!(settings.ha.humidityEntity || settings.ha.temperatureEntity);
  const [status, setStatus] = useState('');
  const [humidity, setHumidity] = useState('');
  const [temp, setTemp] = useState('');
  const h = humidity ? Number(humidity.replace(',', '.')) : undefined;
  const t = temp ? Number(temp.replace(',', '.')) : undefined;
  const valid = (h !== undefined || t !== undefined) && (h === undefined || (h >= 0 && h <= 100)) && (t === undefined || (t > -20 && t < 50));

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Card>
        <Title>🏠 Inside now</Title>
        {now.humidity === undefined && now.temperature === undefined ? (
          <Muted>No readings yet. Connect a Home Assistant sensor in Settings, or type a reading from your hygrometer below.</Muted>
        ) : (
          <>
            <View style={[styles.row, { gap: 24 }]}>
              {now.humidity !== undefined && (
                <View>
                  <Text style={{ fontSize: 36, fontWeight: '700', color: colors.water }}>{Math.round(now.humidity)}%</Text>
                  <Muted>humidity</Muted>
                </View>
              )}
              {now.temperature !== undefined && (
                <View>
                  <Text style={{ fontSize: 36, fontWeight: '700', color: colors.text }}>{now.temperature.toFixed(1)}°</Text>
                  <Muted>temperature</Muted>
                </View>
              )}
            </View>
            {now.at && <Muted>Updated {new Date(now.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Muted>}
          </>
        )}
        {haReady && (
          <>
            <View style={{ height: 10 }} />
            <Button
              label="↻ Read sensors"
              variant="secondary"
              onPress={async () => {
                setStatus('Reading…');
                setStatus((await refreshIndoor()) ?? 'Updated ✓');
              }}
            />
          </>
        )}
        {!!status && <Muted>{status}</Muted>}
      </Card>

      {advice.map((a) => (
        <Card key={a.title} style={a.kind === 'ok' ? undefined : { backgroundColor: a.kind === 'air' ? colors.primarySoft : colors.warnSoft }}>
          <Title>
            {a.emoji} {a.title}
          </Title>
          <Text style={styles.text}>{a.text}</Text>
          {a.humidifier && settings.ha.humidifierEntity && (
            <>
              <View style={{ height: 10 }} />
              <Button
                label="Turn on humidifier"
                onPress={async () => {
                  try {
                    const token = await getHaToken();
                    if (!token) throw new HomeAssistantError('Add your Home Assistant token in Settings.');
                    await turnOn(settings.ha.url, token, settings.ha.humidifierEntity);
                    setStatus('Humidifier turned on ✓');
                  } catch (e) {
                    setStatus(e instanceof Error ? e.message : 'Could not turn it on.');
                  }
                }}
              />
            </>
          )}
        </Card>
      ))}

      {state.readings.length > 1 && (
        <Card>
          <Title>Last 24 hours</Title>
          <Text style={styles.label}>Humidity</Text>
          <Chart values={last24h(state.readings, 'humidity')} low={settings.humidityLow} high={settings.humidityHigh} unit="%" />
          <View style={{ height: 12 }} />
          <Text style={styles.label}>Temperature</Text>
          <Chart values={last24h(state.readings, 'temperature')} low={18} high={24} unit="°" />
        </Card>
      )}

      <Card>
        <Title>Add a reading</Title>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Field label="Humidity (%)" value={humidity} onChangeText={setHumidity} keyboardType="decimal-pad" placeholder="e.g. 32" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Temperature (°C)" value={temp} onChangeText={setTemp} keyboardType="decimal-pad" placeholder="e.g. 21" />
          </View>
        </View>
        <Button
          label="Save reading"
          disabled={!valid}
          onPress={() => {
            addReading({ humidity: h, temperature: t, source: 'manual' });
            setHumidity('');
            setTemp('');
          }}
        />
        <Muted>
          {settings.indoorAlerts
            ? `You'll get a notification when humidity leaves ${settings.humidityLow}–${settings.humidityHigh}% (checked every 10 minutes while the app is open).`
            : 'Indoor alerts are off in Settings.'}
        </Muted>
      </Card>
    </ScrollView>
  );
}
