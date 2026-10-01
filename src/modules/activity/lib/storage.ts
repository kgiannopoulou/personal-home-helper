import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppState } from './types';

const STATE_KEY = 'activity-coach:v1';

export const DEFAULT_STATE: AppState = {
  profile: null,
  workouts: [],
  sleep: [],
  weights: [],
  steps: {},
  coach: { level: 1, sessions: [] },
  schedule: { enabled: false, weekdays: [2, 4, 6], time: '18:00', type: 'gym' },
};

export async function loadState(): Promise<AppState> {
  const raw = await AsyncStorage.getItem(STATE_KEY);
  if (!raw) return DEFAULT_STATE;
  try {
    const saved = JSON.parse(raw) as Partial<AppState>;
    return {
      ...DEFAULT_STATE,
      ...saved,
      coach: { ...DEFAULT_STATE.coach, ...saved.coach },
      schedule: { ...DEFAULT_STATE.schedule, ...saved.schedule },
    };
  } catch {
    return DEFAULT_STATE;
  }
}

export async function saveState(state: AppState): Promise<void> {
  await AsyncStorage.setItem(STATE_KEY, JSON.stringify(state));
}
