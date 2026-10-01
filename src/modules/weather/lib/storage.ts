import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { AppState } from './types';

const STATE_KEY = 'weather-environment:v1';
const HA_TOKEN = 'home-assistant-token';

export const DEFAULT_STATE: AppState = {
  places: [],
  readings: [],
  lastAlerts: {},
  forecast: null,
  settings: {
    useGps: true,
    morningEnabled: true,
    morningHour: 7,
    morningMinute: 0,
    humidityLow: 35,
    humidityHigh: 60,
    indoorAlerts: true,
    ha: { url: '', humidityEntity: '', temperatureEntity: '', humidifierEntity: '' },
  },
};

export async function loadState(): Promise<AppState> {
  const raw = await AsyncStorage.getItem(STATE_KEY);
  if (!raw) return DEFAULT_STATE;
  try {
    const saved = JSON.parse(raw) as Partial<AppState>;
    return {
      ...DEFAULT_STATE,
      ...saved,
      settings: { ...DEFAULT_STATE.settings, ...saved.settings, ha: { ...DEFAULT_STATE.settings.ha, ...saved.settings?.ha } },
    };
  } catch {
    return DEFAULT_STATE;
  }
}

export async function saveState(state: AppState): Promise<void> {
  await AsyncStorage.setItem(STATE_KEY, JSON.stringify(state));
}

// The Home Assistant token goes in the OS keychain on phones; SecureStore has no web version.
export async function getHaToken(): Promise<string | null> {
  if (Platform.OS === 'web') return AsyncStorage.getItem(HA_TOKEN);
  return SecureStore.getItemAsync(HA_TOKEN);
}

export async function setHaToken(token: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (token) await AsyncStorage.setItem(HA_TOKEN, token);
    else await AsyncStorage.removeItem(HA_TOKEN);
    return;
  }
  if (token) await SecureStore.setItemAsync(HA_TOKEN, token);
  else await SecureStore.deleteItemAsync(HA_TOKEN);
}
