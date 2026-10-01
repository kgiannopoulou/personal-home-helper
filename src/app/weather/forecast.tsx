import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { PlacePicker } from '../../modules/weather/components/PlacePicker';
import { Card, colors, Muted, styles, Title } from '../../shared/ui';
import { fromDateKey } from '../../shared/dates';
import { outfitAdvice } from '../../modules/weather/lib/outfit';
import { useStore } from '../../modules/weather/lib/store';
import { hourOf, hoursOf, round, weatherLabel } from '../../modules/weather/lib/weather';

export default function Forecast() {
  const { state } = useStore();
  const f = state.forecast;
  const [open, setOpen] = useState<string | null>(null);
  if (!f) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Card>
          <Muted>No forecast yet. Open the Today tab to load it.</Muted>
        </Card>
      </ScrollView>
    );
  }
  const lo = Math.min(...f.days.map((d) => d.min));
  const hi = Math.max(...f.days.map((d) => d.max));
  const span = Math.max(1, hi - lo);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <PlacePicker />
      <Card>
        <Title>7 days · {f.placeName}</Title>
        {f.days.map((d, i) => {
          const w = weatherLabel(d.code);
          const outfit = open === d.date ? outfitAdvice(f, d.date) : null;
          return (
            <View key={d.date}>
              <Pressable accessibilityRole="button" onPress={() => setOpen(open === d.date ? null : d.date)} style={[styles.listItem, { gap: 10 }]}>
                <Text style={[styles.label, { width: 44 }]}>
                  {i === 0 ? 'Today' : fromDateKey(d.date).toLocaleDateString(undefined, { weekday: 'short' })}
                </Text>
                <Text style={{ fontSize: 20, width: 28 }}>{w.emoji}</Text>
                <Text style={{ width: 40, fontSize: 12, color: d.rainChance >= 50 ? colors.water : colors.muted }}>
                  {d.rainChance ? `${d.rainChance}%` : ''}
                </Text>
                <Text style={[styles.muted, { width: 32, textAlign: 'right' }]}>{round(d.min)}</Text>
                <View style={{ flex: 1, height: 6, backgroundColor: colors.border, borderRadius: 3 }}>
                  <View
                    style={{
                      position: 'absolute',
                      left: `${((d.min - lo) / span) * 100}%`,
                      width: `${Math.max(4, ((d.max - d.min) / span) * 100)}%`,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: d.max >= 25 ? colors.warn : colors.primary,
                    }}
                  />
                </View>
                <Text style={[styles.label, { width: 32 }]}>{round(d.max)}</Text>
              </Pressable>
              {outfit && (
                <View style={{ paddingVertical: 8, paddingLeft: 8 }}>
                  <Text style={styles.label}>
                    {outfit.headline} · {outfit.summary}
                  </Text>
                  {outfit.items.map((it) => (
                    <Text key={it.text} style={[styles.text, { marginTop: 4 }]}>
                      {it.emoji} {it.text}
                    </Text>
                  ))}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                      {hoursOf(f, d.date, 6, 24)
                        .filter((_, idx) => idx % 2 === 0)
                        .map((h) => (
                          <View key={h.time} style={{ alignItems: 'center' }}>
                            <Muted>{hourOf(h)}</Muted>
                            <Text>{weatherLabel(h.code).emoji}</Text>
                            <Text style={styles.label}>{round(h.temp)}</Text>
                          </View>
                        ))}
                    </View>
                  </ScrollView>
                </View>
              )}
            </View>
          );
        })}
        <Muted>Tap a day for what to wear.</Muted>
      </Card>
      <Muted>Weather data by Open-Meteo.com</Muted>
    </ScrollView>
  );
}
