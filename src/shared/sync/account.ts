/**
 * What the phone keeps about the sync account: the token in SecureStore, everything else in
 * AsyncStorage. The ledger and "since" belong to one household; switching household clears them.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { Ledger } from './types';

export interface Account {
  serverUrl: string;
  user: { id: number; name: string; email: string };
  household: { id: string; name: string; role: 'owner' | 'member' } | null;
}

const ACCOUNT_KEY = 'sync:account:v1';
const LEDGER_KEY = 'sync:ledger:v1';
const SINCE_KEY = 'sync:since:v1';
const TOKEN_KEY = 'sync_token';

async function readJson<T>(key: string): Promise<T | null> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export const loadAccount = () => readJson<Account>(ACCOUNT_KEY);
export async function saveAccount(account: Account | null): Promise<void> {
  if (account) await AsyncStorage.setItem(ACCOUNT_KEY, JSON.stringify(account));
  else await AsyncStorage.removeItem(ACCOUNT_KEY);
}

// Phones keep the token in the Keychain / Keystore. SecureStore has no web version, so the
// web build (used for development and the README demo) keeps it in the browser's storage.
const web = Platform.OS === 'web';

export const getToken = () => (web ? AsyncStorage.getItem(TOKEN_KEY) : SecureStore.getItemAsync(TOKEN_KEY));
export async function setToken(token: string | null): Promise<void> {
  if (web) {
    if (token) await AsyncStorage.setItem(TOKEN_KEY, token);
    else await AsyncStorage.removeItem(TOKEN_KEY);
    return;
  }
  if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function loadSyncState(): Promise<{ ledger: Ledger; since: string | null }> {
  return { ledger: (await readJson<Ledger>(LEDGER_KEY)) ?? {}, since: await AsyncStorage.getItem(SINCE_KEY) };
}

export async function saveSyncState(ledger: Ledger, since: string | null): Promise<void> {
  await AsyncStorage.setItem(LEDGER_KEY, JSON.stringify(ledger));
  if (since) await AsyncStorage.setItem(SINCE_KEY, since);
  else await AsyncStorage.removeItem(SINCE_KEY);
}

export async function clearSyncState(): Promise<void> {
  await AsyncStorage.multiRemove([LEDGER_KEY, SINCE_KEY]);
}
