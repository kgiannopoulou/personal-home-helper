import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppState } from './types';

const STATE_KEY = 'money-budget:v1';

export const DEFAULT_STATE: AppState = {
  expenses: [],
  recurring: [],
  rewards: [],
  appliances: [],
  settings: { monthlyBudget: 0, weeklyGroceries: 0, categoryBudgets: {}, currency: '€', kwhPrice: 0.25 },
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
