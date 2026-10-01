import type { DayWeather, Forecast, HourWeather } from './types';

/** WMO weather codes used by Open-Meteo. */
export function weatherLabel(code: number): { emoji: string; text: string } {
  if (code === 0) return { emoji: '☀️', text: 'Clear' };
  if (code === 1) return { emoji: '🌤️', text: 'Mostly clear' };
  if (code === 2) return { emoji: '⛅', text: 'Partly cloudy' };
  if (code === 3) return { emoji: '☁️', text: 'Cloudy' };
  if (code === 45 || code === 48) return { emoji: '🌫️', text: 'Fog' };
  if (code >= 51 && code <= 57) return { emoji: '🌦️', text: 'Drizzle' };
  if (code >= 61 && code <= 67) return { emoji: '🌧️', text: code >= 65 ? 'Heavy rain' : 'Rain' };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { emoji: '🌨️', text: 'Snow' };
  if (code >= 80 && code <= 82) return { emoji: '🌦️', text: 'Showers' };
  if (code >= 95) return { emoji: '⛈️', text: 'Thunderstorm' };
  return { emoji: '🌡️', text: 'Mixed' };
}

export const isSnow = (code: number) => (code >= 71 && code <= 77) || code === 85 || code === 86;
export const isStorm = (code: number) => code >= 95;

const HOURLY = 'temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m,relative_humidity_2m,uv_index';
const DAILY = 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max,sunrise,sunset';
const CURRENT = 'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m';

export function forecastUrl(lat: number, lon: number): string {
  return (
    `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}` +
    `&hourly=${HOURLY}&daily=${DAILY}&current=${CURRENT}&timezone=auto&forecast_days=7&wind_speed_unit=kmh`
  );
}

type Column = (number | string | null)[];

export interface OpenMeteoResponse {
  current: Record<string, number | string>;
  hourly: { time: string[] } & Record<string, Column>;
  daily: { time: string[] } & Record<string, Column>;
}

const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** Turns Open-Meteo's column arrays into rows. */
export function parseForecast(json: OpenMeteoResponse, placeName: string, fetchedAt: Date = new Date()): Forecast {
  const h = json.hourly;
  const hours: HourWeather[] = h.time.map((time, i) => ({
    time,
    temp: n(h.temperature_2m[i]),
    feels: n(h.apparent_temperature[i]),
    rainChance: n(h.precipitation_probability[i]),
    rain: n(h.precipitation[i]),
    code: n(h.weather_code[i]),
    wind: n(h.wind_speed_10m[i]),
    humidity: n(h.relative_humidity_2m[i]),
    uv: n(h.uv_index[i]),
  }));
  const d = json.daily;
  const days: DayWeather[] = d.time.map((date, i) => ({
    date,
    code: n(d.weather_code[i]),
    min: n(d.temperature_2m_min[i]),
    max: n(d.temperature_2m_max[i]),
    rainChance: n(d.precipitation_probability_max[i]),
    uvMax: n(d.uv_index_max[i]),
    sunrise: String(d.sunrise[i] ?? ''),
    sunset: String(d.sunset[i] ?? ''),
  }));
  const c = json.current;
  return {
    fetchedAt: fetchedAt.toISOString(),
    placeName,
    current: {
      temp: n(c.temperature_2m),
      feels: n(c.apparent_temperature),
      humidity: n(c.relative_humidity_2m),
      code: n(c.weather_code),
      wind: n(c.wind_speed_10m),
      time: String(c.time ?? ''),
    },
    hours,
    days,
  };
}

export async function fetchForecast(lat: number, lon: number, placeName: string): Promise<Forecast> {
  const res = await fetch(forecastUrl(lat, lon));
  if (!res.ok) throw new Error(`Weather service error (${res.status})`);
  return parseForecast((await res.json()) as OpenMeteoResponse, placeName);
}

export interface PlaceResult {
  name: string;
  detail: string;
  lat: number;
  lon: number;
}

/** City search (Open-Meteo geocoding, free, no key). */
export async function searchPlaces(query: string): Promise<PlaceResult[]> {
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query.trim())}&count=6&language=en&format=json`);
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
  const json = (await res.json()) as { results?: { name: string; latitude: number; longitude: number; country?: string; admin1?: string }[] };
  return (json.results ?? []).map((r) => ({
    name: r.name,
    detail: [r.admin1, r.country].filter(Boolean).join(', '),
    lat: r.latitude,
    lon: r.longitude,
  }));
}

/** The hours of one local day, optionally limited to [fromHour, toHour). */
export function hoursOf(forecast: Forecast, date: string, fromHour = 0, toHour = 24): HourWeather[] {
  return forecast.hours.filter((h) => {
    if (!h.time.startsWith(date)) return false;
    const hour = Number(h.time.slice(11, 13));
    return hour >= fromHour && hour < toHour;
  });
}

export const hourOf = (h: HourWeather) => h.time.slice(11, 16);
export const round = (t: number) => `${Math.round(t)}°`;
