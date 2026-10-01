import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { AppState } from './types';

const STATE_KEY = 'kitchen-inventory:v1';
const API_KEY = 'anthropic_api_key';

export const DEFAULT_STATE: AppState = {
  items: [],
  toBuy: [],
  settings: { autoAddLow: true, expiryReminders: true },
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

// The API key goes in the OS keychain on phones; SecureStore has no web version.
export async function getApiKey(): Promise<string | null> {
  if (Platform.OS === 'web') return AsyncStorage.getItem(API_KEY);
  return SecureStore.getItemAsync(API_KEY);
}

export async function setApiKey(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (key) await AsyncStorage.setItem(API_KEY, key);
    else await AsyncStorage.removeItem(API_KEY);
    return;
  }
  if (key) await SecureStore.setItemAsync(API_KEY, key);
  else await SecureStore.deleteItemAsync(API_KEY);
}
