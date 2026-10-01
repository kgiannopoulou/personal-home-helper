export type PlaceKind = 'home' | 'work' | 'gym' | 'other';

export interface Place {
  id: string;
  name: string;
  kind: PlaceKind;
  lat: number;
  lon: number;
}

export interface HourWeather {
  /** Local time at the place, "YYYY-MM-DDTHH:MM" */
  time: string;
  temp: number;
  feels: number;
  /** % chance */
  rainChance: number;
  /** mm */
  rain: number;
  code: number;
  /** km/h */
  wind: number;
  humidity: number;
  uv: number;
}

export interface DayWeather {
  /** YYYY-MM-DD */
  date: string;
  code: number;
  min: number;
  max: number;
  rainChance: number;
  uvMax: number;
  sunrise: string;
  sunset: string;
}

export interface Forecast {
  /** When it was fetched (ISO) */
  fetchedAt: string;
  placeName: string;
  current: { temp: number; feels: number; humidity: number; code: number; wind: number; time: string };
  hours: HourWeather[];
  days: DayWeather[];
}

export interface Reading {
  /** ISO */
  at: string;
  humidity?: number;
  temperature?: number;
  source: 'manual' | 'homeassistant';
}

export interface HomeAssistantConfig {
  /** e.g. http://homeassistant.local:8123 */
  url: string;
  humidityEntity: string;
  temperatureEntity: string;
  /** humidifier.* or switch.* to turn on from the app */
  humidifierEntity: string;
}

export interface Settings {
  /** Use the phone's location instead of a saved place */
  useGps: boolean;
  activePlaceId?: string;
  morningEnabled: boolean;
  morningHour: number;
  morningMinute: number;
  humidityLow: number;
  humidityHigh: number;
  indoorAlerts: boolean;
  ha: HomeAssistantConfig;
}

export interface AppState {
  places: Place[];
  readings: Reading[];
  settings: Settings;
  /** Last indoor alert per kind, to avoid repeating it (ISO) */
  lastAlerts: Record<string, string>;
  forecast: Forecast | null;
}
