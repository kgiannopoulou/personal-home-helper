import { describe, expect, test } from '@jest/globals';
import { parseSensorState } from '../../src/modules/weather/lib/homeAssistant';
import { alertsToSend, indoorAdvice, last24h, latest, pruneReadings } from '../../src/modules/weather/lib/indoor';
import { layerIndex, outfitAdvice } from '../../src/modules/weather/lib/outfit';
import type { Forecast, Reading } from '../../src/modules/weather/lib/types';
import { forecastUrl, hoursOf, parseForecast, weatherLabel } from '../../src/modules/weather/lib/weather';

const DATE = '2026-10-15';

/** A fake Open-Meteo response for one day, built from per-hour overrides. */
function fakeDay(hour: (h: number) => Partial<{ temp: number; feels: number; rain: number; chance: number; code: number; wind: number; uv: number }>): Forecast {
  const hrs = Array.from({ length: 24 }, (_, h) => ({ temp: 15, rain: 0, chance: 0, code: 1, wind: 10, uv: 2, ...hour(h) }));
  return parseForecast(
    {
      current: { time: `${DATE}T09:00`, temperature_2m: 12, apparent_temperature: 10, relative_humidity_2m: 70, weather_code: 3, wind_speed_10m: 12 },
      hourly: {
        time: hrs.map((_, h) => `${DATE}T${String(h).padStart(2, '0')}:00`),
        temperature_2m: hrs.map((x) => x.temp),
        apparent_temperature: hrs.map((x) => x.feels ?? x.temp),
        precipitation_probability: hrs.map((x) => x.chance),
        precipitation: hrs.map((x) => x.rain),
        weather_code: hrs.map((x) => x.code),
        wind_speed_10m: hrs.map((x) => x.wind),
        relative_humidity_2m: hrs.map(() => 60),
        uv_index: hrs.map((x) => x.uv),
      },
      daily: {
        time: [DATE],
        weather_code: [3],
        temperature_2m_max: [Math.max(...hrs.map((x) => x.temp))],
        temperature_2m_min: [Math.min(...hrs.map((x) => x.temp))],
        precipitation_probability_max: [Math.max(...hrs.map((x) => x.chance))],
        uv_index_max: [Math.max(...hrs.map((x) => x.uv))],
        sunrise: [`${DATE}T07:30`],
        sunset: [`${DATE}T18:40`],
      },
    },
    'Testville',
    new Date(2026, 9, 15, 9),
  );
}

const texts = (f: Forecast) => outfitAdvice(f, DATE)!.items.map((i) => i.text).join(' | ');

describe('forecast', () => {
  test('url asks for local times and km/h', () => {
    const url = forecastUrl(40.6401, 22.9444);
    expect(url).toContain('latitude=40.6401&longitude=22.9444');
    expect(url).toContain('timezone=auto');
    expect(url).toContain('wind_speed_unit=kmh');
  });

  test('parses columns into rows, nulls become 0', () => {
    const f = fakeDay((h) => ({ temp: h }));
    expect(f.hours).toHaveLength(24);
    expect(f.hours[14]).toMatchObject({ time: `${DATE}T14:00`, temp: 14, feels: 14 });
    expect(f.days[0]).toMatchObject({ date: DATE, min: 0, max: 23, sunset: `${DATE}T18:40` });
    expect(f.current.humidity).toBe(70);
    expect(hoursOf(f, DATE, 7, 22)).toHaveLength(15);
  });

  test('weather codes', () => {
    expect(weatherLabel(0).text).toBe('Clear');
    expect(weatherLabel(63).text).toBe('Rain');
    expect(weatherLabel(75).emoji).toBe('🌨️');
    expect(weatherLabel(96).text).toBe('Thunderstorm');
  });
});

describe('what to wear', () => {
  test('layers by how warm it feels', () => {
    expect([-3, 5, 10, 15, 20, 30].map(layerIndex)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  test('chilly morning, warm afternoon → layers you can take off', () => {
    const f = fakeDay((h) => ({ temp: h < 11 ? 8 : h < 18 ? 21 : 16 }));
    const o = outfitAdvice(f, DATE)!;
    expect(o.headline).toBe('Chilly morning, warm afternoon');
    expect(o.items[0].text).toContain('t-shirt underneath');
    expect(o.summary).toBe('8° → 21° · dry');
  });

  test('rainy afternoon → umbrella and waterproof shoes, with the time', () => {
    const f = fakeDay((h) => ({ temp: 12, chance: h >= 14 && h < 17 ? 80 : 10, rain: h >= 14 && h < 17 ? 1.2 : 0, code: h >= 14 && h < 17 ? 63 : 3 }));
    const o = outfitAdvice(f, DATE)!;
    expect(o.headline).toBe('Cool and rainy');
    expect(texts(f)).toContain('Rain likely around 14:00–17:00 (80%)');
    expect(texts(f)).toContain('Waterproof shoes');
    expect(o.summary).toBe('12° → 12° · rain 14:00–17:00');
  });

  test('maybe rain, wind and UV', () => {
    const f = fakeDay((h) => ({ temp: 26, chance: 40, wind: h === 15 ? 45 : 10, uv: h === 13 ? 7 : 2 }));
    const t = texts(f);
    expect(t).toContain('pack a small umbrella');
    expect(t).toContain('a hood beats an umbrella');
    expect(t).toContain('UV is high (7)');
    expect(t).toContain('sandals');
  });

  test('snow and freezing', () => {
    const f = fakeDay(() => ({ temp: -2, code: 73 }));
    expect(outfitAdvice(f, DATE)!.headline).toBe('Snow today');
    expect(texts(f)).toContain('Winter coat');
    expect(texts(f)).toContain('boots with good grip');
  });

  test('uses feels-like temperature', () => {
    const f = fakeDay(() => ({ temp: 10, feels: 4 }));
    expect(texts(f)).toContain('Warm coat');
    expect(outfitAdvice(f, '2026-10-20')).toBeNull();
  });
});

describe('indoor air', () => {
  const settings = { humidityLow: 35, humidityHigh: 60 };

  test('dry air → humidifier', () => {
    const [a] = indoorAdvice({ humidity: 28, temperature: 21 }, settings);
    expect(a).toMatchObject({ kind: 'dry', humidifier: true, title: 'Air is dry (28%)' });
  });

  test('humid and warm, with an airing tip when it is cooler outside', () => {
    const advice = indoorAdvice({ humidity: 68, temperature: 27 }, settings, { temp: 12, raining: false });
    expect(advice.map((a) => a.kind)).toEqual(['humid', 'warm', 'air']);
    expect(indoorAdvice({ humidity: 68, temperature: 22 }, settings, { temp: 12, raining: true }).map((a) => a.kind)).toEqual(['humid']);
  });

  test('dry and cold outside → keep airing short', () => {
    expect(indoorAdvice({ humidity: 30, temperature: 20 }, settings, { temp: 2, raining: false }).map((a) => a.kind)).toEqual(['dry', 'air']);
  });

  test('alerts are not repeated within 3 hours', () => {
    const now = new Date(2026, 9, 15, 12);
    const advice = indoorAdvice({ humidity: 28, temperature: 16 }, settings);
    expect(alertsToSend(advice, {}, now).map((a) => a.kind)).toEqual(['dry', 'cold']);
    expect(alertsToSend(advice, { dry: new Date(2026, 9, 15, 10).toISOString() }, now).map((a) => a.kind)).toEqual(['cold']);
    expect(alertsToSend(advice, { dry: new Date(2026, 9, 15, 8).toISOString() }, now).map((a) => a.kind)).toEqual(['dry', 'cold']);
  });

  test('readings: latest values, pruning and the 24 h chart', () => {
    const now = new Date(2026, 9, 15, 12);
    const r = (hoursAgo: number, patch: Partial<Reading>): Reading => ({ at: new Date(now.getTime() - hoursAgo * 3600000).toISOString(), source: 'manual', ...patch });
    const readings = [r(200, { humidity: 50 }), r(5, { humidity: 40, temperature: 20 }), r(1.5, { humidity: 30 }), r(1.2, { humidity: 34 })];
    expect(latest(readings)).toMatchObject({ humidity: 34, temperature: 20 });
    expect(pruneReadings(readings, now)).toHaveLength(3);
    const chart = last24h(readings, 'humidity', now);
    expect(chart).toHaveLength(24);
    expect(chart[22]).toBe(32);
    expect(chart[19]).toBe(40);
    expect(chart[0]).toBeNull();
  });

  test('Home Assistant sensor states', () => {
    expect(parseSensorState('41.5')).toBe(41.5);
    expect(parseSensorState('unavailable')).toBeUndefined();
    expect(parseSensorState('')).toBeUndefined();
    expect(parseSensorState(undefined)).toBeUndefined();
  });
});
