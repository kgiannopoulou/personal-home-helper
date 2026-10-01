import type { Reading, Settings } from './types';

export type AlertKind = 'dry' | 'humid' | 'cold' | 'warm';

export interface IndoorAdvice {
  kind: AlertKind | 'ok' | 'air';
  emoji: string;
  title: string;
  text: string;
  /** Show a button to turn on the humidifier */
  humidifier?: boolean;
}

/** Latest reading that has each value (sensors can report humidity and temperature separately). */
export function latest(readings: Reading[]): { humidity?: number; temperature?: number; at?: string } {
  const sorted = [...readings].sort((a, b) => b.at.localeCompare(a.at));
  const h = sorted.find((r) => r.humidity !== undefined);
  const t = sorted.find((r) => r.temperature !== undefined);
  return { humidity: h?.humidity, temperature: t?.temperature, at: sorted[0]?.at };
}

/**
 * Advice from indoor humidity/temperature, and when it's a good idea to air the room
 * (cold outside air holds less moisture, so airing dries a humid flat but makes a dry one drier).
 */
export function indoorAdvice(
  indoor: { humidity?: number; temperature?: number },
  settings: Pick<Settings, 'humidityLow' | 'humidityHigh'>,
  outdoor?: { temp: number; raining: boolean },
): IndoorAdvice[] {
  const out: IndoorAdvice[] = [];
  const { humidity: h, temperature: t } = indoor;

  if (h !== undefined) {
    if (h < settings.humidityLow) {
      out.push({
        kind: 'dry',
        emoji: '💧',
        title: `Air is dry (${Math.round(h)}%)`,
        text: `Turn on the humidifier. Aim for ${settings.humidityLow}–${settings.humidityHigh}%; dry air irritates skin, eyes and throat.`,
        humidifier: true,
      });
    } else if (h > settings.humidityHigh) {
      out.push({
        kind: 'humid',
        emoji: '💦',
        title: `Humid inside (${Math.round(h)}%)`,
        text: 'Open a window or run the dehumidifier to keep mould away. Don’t dry laundry indoors right now.',
      });
    } else {
      out.push({ kind: 'ok', emoji: '✅', title: `Humidity is comfortable (${Math.round(h)}%)`, text: 'No need for the humidifier.' });
    }
  }

  if (t !== undefined) {
    if (t < 17) out.push({ kind: 'cold', emoji: '🥶', title: `Chilly inside (${t.toFixed(1)}°)`, text: 'Turn the heating up a little, or grab a jumper.' });
    else if (t > 26) out.push({ kind: 'warm', emoji: '🥵', title: `Warm inside (${t.toFixed(1)}°)`, text: 'Ventilate, close the blinds on the sunny side, or turn the heating down.' });
  }

  if (outdoor && t !== undefined && h !== undefined && !outdoor.raining) {
    if (h > settings.humidityHigh - 5 && outdoor.temp < t - 3) {
      out.push({ kind: 'air', emoji: '🪟', title: 'Good time to air out', text: 'Open the windows wide for 5–10 minutes: the cooler air outside is drier.' });
    } else if (h < settings.humidityLow && outdoor.temp < 8) {
      out.push({ kind: 'air', emoji: '🪟', title: 'Keep airing short', text: 'Cold outside air will make the room even drier. Air for 3–5 minutes at most.' });
    }
  }
  return out;
}

/** Alerts worth a notification: out of range, and not already sent in the last `hours`. */
export function alertsToSend(advice: IndoorAdvice[], lastAlerts: Record<string, string>, now: Date = new Date(), hours = 3): IndoorAdvice[] {
  return advice.filter((a) => {
    if (a.kind === 'ok' || a.kind === 'air') return false;
    const last = lastAlerts[a.kind];
    return !last || now.getTime() - new Date(last).getTime() >= hours * 3600 * 1000;
  });
}

/** Keeps the last 7 days of readings. */
export function pruneReadings(readings: Reading[], now: Date = new Date()): Reading[] {
  const cutoff = now.getTime() - 7 * 24 * 3600 * 1000;
  return readings.filter((r) => new Date(r.at).getTime() >= cutoff).slice(-2000);
}

/** Hourly averages for the last 24 hours, for the chart. */
export function last24h(readings: Reading[], key: 'humidity' | 'temperature', now: Date = new Date()): (number | null)[] {
  const start = now.getTime() - 24 * 3600 * 1000;
  const buckets: number[][] = Array.from({ length: 24 }, () => []);
  for (const r of readings) {
    const v = r[key];
    const t = new Date(r.at).getTime();
    if (v === undefined || t < start || t > now.getTime()) continue;
    buckets[Math.min(23, Math.floor((t - start) / 3600000))].push(v);
  }
  return buckets.map((b) => (b.length ? b.reduce((a, c) => a + c, 0) / b.length : null));
}
