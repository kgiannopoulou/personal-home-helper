import AsyncStorage from '@react-native-async-storage/async-storage';
import { defaultHome } from './defaults';
import type { AppState } from './types';

const STATE_KEY = 'home-chores:v1';

export const DEFAULT_SETTINGS: AppState['settings'] = {
  //            Sun Mon Tue Wed Thu Fri Sat
  dailyMinutes: [45, 20, 20, 20, 20, 15, 60],
  laundryMinutes: 90,
};

export const EMPTY_STATE: AppState = {
  rooms: [],
  tasks: [],
  completions: [],
  supplies: [],
  members: [],
  laundry: null,
  pinned: { date: '', taskIds: [] },
  settings: DEFAULT_SETTINGS,
};

export async function loadState(): Promise<AppState> {
  const raw = await AsyncStorage.getItem(STATE_KEY);
  // First start: a home with typical rooms, chores and cleaning supplies to edit.
  if (!raw) return { ...EMPTY_STATE, ...defaultHome() };
  try {
    const saved = JSON.parse(raw) as Partial<AppState>;
    return { ...EMPTY_STATE, ...saved, settings: { ...DEFAULT_SETTINGS, ...saved.settings } };
  } catch {
    return { ...EMPTY_STATE, ...defaultHome() };
  }
}

export async function saveState(state: AppState): Promise<void> {
  await AsyncStorage.setItem(STATE_KEY, JSON.stringify(state));
}
