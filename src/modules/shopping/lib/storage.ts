import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppState } from './types';

const STATE_KEY = 'smart-shopping-list:v1';

export const DEFAULT_STATE: AppState = {
  items: [],
  trips: [],
  prices: {},
  history: {},
  settings: { weeklyBudget: 80, monthlyBudget: 0, currency: '€' },
};

export async function loadState(): Promise<AppState> {
  const raw = await AsyncStorage.getItem(STATE_KEY);
  if (!raw) return DEFAULT_STATE;
  try {
    const saved = JSON.parse(raw) as Partial<AppState>;
    return { ...DEFAULT_STATE, ...saved, settings: { ...DEFAULT_STATE.settings, ...saved.settings } };
  } catch {
    return DEFAULT_STATE;
  }
}

export async function saveState(state: AppState): Promise<void> {
  await AsyncStorage.setItem(STATE_KEY, JSON.stringify(state));
}
