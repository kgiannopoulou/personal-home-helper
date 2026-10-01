import { useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { PlacePicker } from '../../modules/weather/components/PlacePicker';
import { Button, Card, colors, Muted, styles, Title } from '../../shared/ui';
import { toDateKey } from '../../shared/dates';
import { outfitAdvice } from '../../modules/weather/lib/outfit';
import { useStore } from '../../modules/weather/lib/store';
import { hourOf, hoursOf, round, weatherLabel } from '../../modules/weather/lib/weather';

export default function Today() {
  const { state, loading, error, refreshWeather } = useStore();
  const f = state.forecast;
  // Open-Meteo returns local times at the place, so "today" is the place's date.
  const today = f?.current.time.slice(0, 10) || toDateKey();
  const tomorrow = f?.days[1]?.date;
  const now = new Date();
  const lateEvening = now.getHours() >= 20;
  const date = lateEvening && tomorrow ? tomorrow : today;
  const outfit = useMemo(() => (f ? outfitAdvice(f, date) : null), [f, date]);
  const nowHour = f?.current.time.slice(0, 13) ?? '';
  const upcoming = f ? f.hours.filter((h) => h.time.slice(0, 13) >= nowHour).slice(0, 12) : [];
  const day = f?.days.find((d) => d.date === date);

  if (!f) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <PlacePicker />
        <Card>
          <Title>🌤️ Weather</Title>
          {loading ? (
            <>
              <ActivityIndicator color={colors.primary} />
              <Muted>Finding your location… Allow location access, or add your home in Settings.</Muted>
            </>
          ) : (
            <Muted>{error ?? 'No forecast yet.'}</Muted>
          )}
          <View style={{ height: 10 }} />
          {!loading && <Button label="Try again" onPress={refreshWeather} />}
        </Card>
      </ScrollView>
    );
  }

  const cur = weatherLabel(f.current.code);
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <PlacePicker />
      <Card>
        <View style={styles.progressHeader}>
          <View style={{ flex: 1 }}>
            <Muted>📍 {f.placeName}</Muted>
            <Text style={{ fontSize: 44, fontWeight: '700', color: colors.text }}>
              {cur.emoji} {round(f.current.temp)}
            </Text>
            <Muted>
              {cur.text} · feels like {round(f.current.feels)} · 💧 {Math.round(f.current.humidity)}% · 💨 {Math.round(f.current.wind)} km/h
            </Muted>
          </View>
        </View>
        {day && (
          <Muted>
            Today {round(day.min)} / {round(day.max)}
            {day.rainChance ? ` · rain ${day.rainChance}%` : ''} · sunset {day.sunset.slice(11, 16)}
          </Muted>
        )}
        <Pressable accessibilityRole="button" onPress={refreshWeather} style={{ marginTop: 6 }}>
          <Text style={{ color: colors.primary }}>
            {loading ? 'Updating…' : `↻ Updated ${new Date(f.fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
          </Text>
        </Pressable>
        {!!error && <Text style={{ color: colors.danger, marginTop: 4 }}>{error}</Text>}
      </Card>

      {outfit && (
        <Card style={{ backgroundColor: colors.primarySoft }}>
          <Muted>{date === today ? 'What to wear today' : 'What to wear tomorrow'}</Muted>
          <Title>{outfit.headline}</Title>
          <Muted>{outfit.summary}</Muted>
          <View style={{ height: 8 }} />
          {outfit.items.map((i) => (
            <View key={i.text} style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
              <Text style={{ fontSize: 18 }}>{i.emoji}</Text>
              <Text style={[styles.text, { flex: 1 }]}>{i.text}</Text>
            </View>
          ))}
        </Card>
      )}

      <Card>
        <Title>Next hours</Title>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: 14 }}>
            {upcoming.map((h) => (
              <View key={h.time} style={{ alignItems: 'center', width: 48 }}>
                <Muted>{h.time.slice(0, 13) === nowHour ? 'Now' : hourOf(h)}</Muted>
                <Text style={{ fontSize: 22, marginVertical: 4 }}>{weatherLabel(h.code).emoji}</Text>
                <Text style={styles.label}>{round(h.temp)}</Text>
                <Text style={{ fontSize: 12, color: h.rainChance >= 50 ? colors.water : colors.muted }}>{h.rainChance}%</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </Card>

      {date === today && tomorrow && (
        <TomorrowCard date={tomorrow} />
      )}
    </ScrollView>
  );
}

function TomorrowCard({ date }: { date: string }) {
  const { state } = useStore();
  const f = state.forecast;
  const outfit = useMemo(() => (f ? outfitAdvice(f, date) : null), [f, date]);
  const day = f?.days.find((d) => d.date === date);
  if (!f || !outfit || !day || !hoursOf(f, date).length) return null;
  return (
    <Card>
      <Muted>Tomorrow</Muted>
      <Text style={styles.label}>
        {weatherLabel(day.code).emoji} {outfit.headline} · {outfit.summary}
      </Text>
      <Muted>{outfit.items[0]?.text}</Muted>
    </Card>
  );
}
