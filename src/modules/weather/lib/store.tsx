import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { newId } from '../../../shared/dates';
import { readSensor } from './homeAssistant';
import { alertsToSend, indoorAdvice, latest, pruneReadings } from './indoor';
import { currentPosition } from './location';
import { sendIndoorAlert, syncMorningWeather } from './notifications';
import { DEFAULT_STATE, getHaToken, loadState, saveState } from './storage';
import type { AppState, Place, Reading, Settings } from './types';
import { fetchForecast } from './weather';

interface Store {
  state: AppState;
  ready: boolean;
  loading: boolean;
  error: string | null;
  refreshWeather: () => Promise<void>;
  /** Reads the Home Assistant sensors now; returns an error message or null */
  refreshIndoor: () => Promise<string | null>;
  addReading: (r: Omit<Reading, 'at'>) => void;
  addPlace: (p: Omit<Place, 'id'>) => void;
  removePlace: (id: string) => void;
  selectPlace: (id: string | null) => void;
  setSettings: (s: Settings) => void;
}

const StoreContext = createContext<Store | null>(null);
const INDOOR_EVERY = 10 * 60 * 1000;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(DEFAULT_STATE);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loaded = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  const commit = (next: AppState) => {
    stateRef.current = next;
    setState(next);
  };
  const update = (fn: (s: AppState) => AppState) => commit(fn(stateRef.current));

  const refreshWeather = useCallback(async () => {
    const s = stateRef.current;
    setLoading(true);
    setError(null);
    try {
      const place = s.places.find((p) => p.id === s.settings.activePlaceId);
      let target: { lat: number; lon: number; name: string } | undefined;
      if (s.settings.useGps || !place) {
        try {
          target = await currentPosition();
        } catch (e) {
          // Fall back to the first saved place.
          const fallback = place ?? s.places[0];
          if (!fallback) throw e;
          target = fallback;
        }
      } else {
        target = place;
      }
      const forecast = await fetchForecast(target.lat, target.lon, target.name);
      update((st) => ({ ...st, forecast }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the weather.');
    } finally {
      setLoading(false);
    }
  }, []);

  /** Saves readings and sends a notification for new indoor problems. */
  const recordReading = useCallback((reading: Reading) => {
    const s = stateRef.current;
    const readings = pruneReadings([...s.readings, reading]);
    let lastAlerts = s.lastAlerts;
    if (s.settings.indoorAlerts) {
      const now = new Date();
      const current = s.forecast?.current;
      const advice = indoorAdvice(latest(readings), s.settings, current ? { temp: current.temp, raining: current.code >= 51 } : undefined);
      const toSend = alertsToSend(advice, s.lastAlerts, now);
      if (toSend.length) {
        lastAlerts = { ...s.lastAlerts };
        for (const a of toSend) {
          lastAlerts[a.kind] = now.toISOString();
          sendIndoorAlert(a).catch((e) => console.warn('Could not send alert', e));
        }
      }
    }
    commit({ ...stateRef.current, readings, lastAlerts });
  }, []);

  const refreshIndoor = useCallback(async () => {
    const { ha } = stateRef.current.settings;
    if (!ha.url || (!ha.humidityEntity && !ha.temperatureEntity)) return 'Set up Home Assistant in Settings first.';
    const token = await getHaToken();
    if (!token) return 'Add your Home Assistant token in Settings.';
    try {
      const [humidity, temperature] = await Promise.all([
        ha.humidityEntity ? readSensor(ha.url, token, ha.humidityEntity) : undefined,
        ha.temperatureEntity ? readSensor(ha.url, token, ha.temperatureEntity) : undefined,
      ]);
      if (humidity === undefined && temperature === undefined) return 'The sensors are unavailable right now.';
      recordReading({ at: new Date().toISOString(), humidity, temperature, source: 'homeassistant' });
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : 'Could not read the sensors.';
    }
  }, [recordReading]);

  useEffect(() => {
    loadState().then((s) => {
      commit(s);
      loaded.current = true;
      setReady(true);
      refreshWeather();
      refreshIndoor();
    });
  }, [refreshWeather, refreshIndoor]);

  useEffect(() => {
    if (loaded.current) saveState(state).catch((e) => console.warn('Could not save state', e));
  }, [state]);

  // While the app is open, check the indoor sensors every 10 minutes.
  useEffect(() => {
    if (!ready) return;
    const id = setInterval(() => {
      refreshIndoor();
    }, INDOOR_EVERY);
    return () => clearInterval(id);
  }, [ready, refreshIndoor]);

  // Keep the morning "what to wear" notifications in line with the latest forecast.
  const { morningEnabled, morningHour, morningMinute } = state.settings;
  useEffect(() => {
    if (!ready) return;
    syncMorningWeather(state.forecast, morningEnabled, morningHour, morningMinute).catch((e) => console.warn('Could not schedule weather', e));
  }, [ready, state.forecast, morningEnabled, morningHour, morningMinute]);

  const addReading = useCallback((r: Omit<Reading, 'at'>) => recordReading({ ...r, at: new Date().toISOString() }), [recordReading]);

  const addPlace = useCallback((p: Omit<Place, 'id'>) => {
    update((s) => ({ ...s, places: [...s.places, { ...p, id: newId() }] }));
  }, []);
  const removePlace = useCallback((id: string) => {
    update((s) => ({
      ...s,
      places: s.places.filter((p) => p.id !== id),
      settings: s.settings.activePlaceId === id ? { ...s.settings, activePlaceId: undefined, useGps: true } : s.settings,
    }));
  }, []);
  const selectPlace = useCallback(
    (id: string | null) => {
      update((s) => ({ ...s, settings: { ...s.settings, useGps: id === null, activePlaceId: id ?? s.settings.activePlaceId } }));
      refreshWeather();
    },
    [refreshWeather],
  );
  const setSettings = useCallback((settings: Settings) => update((s) => ({ ...s, settings })), []);

  const value = useMemo(
    () => ({ state, ready, loading, error, refreshWeather, refreshIndoor, addReading, addPlace, removePlace, selectPlace, setSettings }),
    [state, ready, loading, error, refreshWeather, refreshIndoor, addReading, addPlace, removePlace, selectPlace, setSettings],
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside <StoreProvider>');
  return store;
}
