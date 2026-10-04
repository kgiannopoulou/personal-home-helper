/**
 * Runs sync in the app: watches every module for changes (the ledger), and swaps them with the
 * server on start, when the app comes back to the foreground, and a few seconds after a change.
 * The rules live in engine.ts; this file only connects them to the stores, storage and the server.
 */
import * as Notifications from 'expo-notifications';
import { useRootNavigationState, useRouter, type Href } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';
import { useStore as useActivity } from '../../modules/activity/lib/store';
import { useStore as useChores } from '../../modules/chores/lib/store';
import { useStore as useFood } from '../../modules/food/lib/store';
import { useStore as useKitchen } from '../../modules/kitchen/lib/store';
import { useStore as useMoney } from '../../modules/money/lib/store';
import { useStore as usePlanner } from '../../modules/planner/lib/store';
import { useStore as useShopping } from '../../modules/shopping/lib/store';
import { clearSyncState, getToken, loadAccount, loadSyncState, saveAccount, saveSyncState, setToken, type Account } from './account';
import { api, ApiError, normalizeServerUrl, type HouseholdInfo, type MemberInfo } from './api';
import { MODULES, observe, syncOnce, withHouseholdMembers, type SyncIO } from './engine';
import { expoPushToken, type PushState } from './push';
import { pushRoute } from './pushRoute';
import type { Ledger, ModuleStates } from './types';

/** Wait this long after a change, so a burst of taps is one sync */
const AFTER_CHANGE_MS = 4000;
/** Taps on pushes; the web build has no notifications, so there's never one */
const useLastTap = Platform.OS === 'web' ? () => null : Notifications.useLastNotificationResponse;
/** Try again this long after the server couldn't be reached */
const RETRY_MS = 60000;

export interface SyncStatus {
  syncing: boolean;
  lastSync?: string;
  error?: string;
  /** Records the server refused at the last sync */
  refused: number;
}

interface SyncValue {
  account: Account | null;
  loaded: boolean;
  status: SyncStatus;
  /** Whether the server's jobs can reach this phone; null until checked */
  push: PushState | null;
  signIn: (serverUrl: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  households: () => Promise<HouseholdInfo[]>;
  chooseHousehold: (h: HouseholdInfo) => Promise<void>;
  createHousehold: (name: string) => Promise<void>;
  members: () => Promise<MemberInfo[]>;
  invite: (email: string) => Promise<void>;
  join: (link: string) => Promise<void>;
  syncNow: () => void;
}

const SyncContext = createContext<SyncValue | null>(null);

export function SyncProvider({ children }: { children: ReactNode }) {
  const stores = {
    money: useMoney(),
    kitchen: useKitchen(),
    shopping: useShopping(),
    chores: useChores(),
    food: useFood(),
    activity: useActivity(),
    planner: usePlanner(),
  };
  const storesRef = useRef(stores);
  storesRef.current = stores;
  const storesReady = MODULES.every((m) => stores[m].ready);

  const [account, setAccount] = useState<Account | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<SyncStatus>({ syncing: false, refused: 0 });
  const [push, setPush] = useState<PushState | null>(null);
  const router = useRouter();
  const token = useRef<string | null>(null);
  const ledger = useRef<Ledger>({});
  const since = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const running = useRef(false);
  const again = useRef(false);
  const accountRef = useRef(account);
  accountRef.current = account;

  useEffect(() => {
    (async () => {
      const [a, t, s] = await Promise.all([loadAccount(), getToken(), loadSyncState()]);
      token.current = t;
      ledger.current = s.ledger;
      since.current = s.since;
      setAccount(t ? a : null);
      setLoaded(true);
    })().catch(() => setLoaded(true));
  }, []);

  const active = loaded && storesReady && !!account?.household && !!token.current;

  const client = useCallback(() => {
    const a = accountRef.current;
    if (!a) throw new ApiError(0, 'Not signed in');
    return api(a.serverUrl, token.current);
  }, []);

  const persist = useCallback(() => saveSyncState(ledger.current, since.current).catch(() => {}), []);

  const run = useCallback(async () => {
    const a = accountRef.current;
    if (!a?.household || !token.current) return;
    if (running.current) {
      again.current = true;
      return;
    }
    running.current = true;
    setStatus((s) => ({ ...s, syncing: true }));
    const householdId = a.household.id;
    try {
      const io: SyncIO = {
        states: () => Object.fromEntries(MODULES.map((m) => [m, storesRef.current[m].state])) as unknown as ModuleStates,
        apply: (m, fn) => storesRef.current[m].applySync(fn as never),
        ledger: { get: () => ledger.current, set: (l) => (ledger.current = l) },
        send: (request) => client().sync(householdId, request),
        ctx: { userId: a.user.id },
      };
      const result = await syncOnce(io, since.current);
      since.current = result.since;
      await persist();
      setStatus({ syncing: false, lastSync: new Date().toISOString(), refused: result.rejected.length });
    } catch (e) {
      const err = e instanceof ApiError ? e : new ApiError(0, String(e));
      if (err.status === 401) {
        await setToken(null);
        token.current = null;
        setAccount(null);
        setStatus({ syncing: false, refused: 0, error: 'You were signed out. Sign in again to keep syncing.' });
      } else {
        setStatus((s) => ({ ...s, syncing: false, error: err.status === 0 ? 'Offline: will sync when the server can be reached.' : err.message }));
        if (err.status === 0 || err.status >= 500) schedule(RETRY_MS);
      }
    } finally {
      running.current = false;
      if (again.current) {
        again.current = false;
        schedule(0);
      }
    }
    // schedule is stable and defined below; it only sets a timer
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, persist]);

  const schedule = useCallback(
    (ms: number) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        run();
      }, ms);
    },
    [run],
  );

  // Every change in a module: note it in the ledger and sync a little later
  const states = MODULES.map((m) => stores[m].state);
  useEffect(() => {
    if (!active) return;
    const now = new Date().toISOString();
    let l = ledger.current;
    for (const m of MODULES) l = observe(l, m, storesRef.current[m].state as never, { userId: accountRef.current!.user.id }, now);
    if (l === ledger.current) return;
    ledger.current = l;
    persist();
    schedule(AFTER_CHANGE_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, ...states]);

  // On start (once signed in and every module has loaded) and back in the foreground
  useEffect(() => {
    if (!active) return;
    schedule(0);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && schedule(0));
    return () => sub.remove();
  }, [active, schedule]);

  const loadMembers = useCallback(async () => {
    const a = accountRef.current;
    if (!a?.household) return [];
    const members = await client().members(a.household.id);
    storesRef.current.chores.applySync((s) => withHouseholdMembers(s, members, a.user.id) as ModuleStates['chores']);
    return members;
  }, [client]);

  useEffect(() => {
    if (active) loadMembers().catch(() => {});
  }, [active, loadMembers]);

  // Once signed in to a household, give the server this phone's push token (again on every start,
  // so a new token or a new login is picked up). Logging out deletes it on the server.
  const userId = account?.user.id;
  useEffect(() => {
    if (!active) return;
    (async () => {
      const state = await expoPushToken();
      if (state.on) await client().registerDevice({ token: state.token, platform: Platform.OS === 'ios' ? 'ios' : 'android', name: `${Platform.OS} phone` });
      setPush(state);
    })().catch((e) => setPush({ on: false, reason: e instanceof ApiError ? e.message : 'Could not turn on notifications from the server.' }));
  }, [active, userId, client]);

  // Tapping a push opens the screen it's about, also when it started the app (once the navigator is up)
  const lastTap = useLastTap();
  const navReady = !!useRootNavigationState()?.key;
  useEffect(() => {
    const route = navReady ? pushRoute(lastTap?.notification.request.content.data) : null;
    if (route) router.push(route as Href);
  }, [lastTap, navReady, router]);

  const switchHousehold = useCallback(async (h: HouseholdInfo) => {
    const a = accountRef.current!;
    if (a.household?.id !== h.id) {
      // A new household starts from nothing: everything here is shared with it on the first sync
      ledger.current = {};
      since.current = null;
      await clearSyncState();
    }
    const next = { ...a, household: { id: h.id, name: h.name, role: h.role } };
    await saveAccount(next);
    setAccount(next);
  }, []);

  const value = useMemo<SyncValue>(
    () => ({
      account,
      loaded,
      status,
      push,
      signIn: async (serverUrl, email, password) => {
        const url = normalizeServerUrl(serverUrl);
        const { token: t, user } = await api(url, null).login(email.trim(), password, `${Platform.OS} phone`);
        await setToken(t);
        token.current = t;
        const households = await api(url, t).households();
        const previous = await loadAccount();
        const keep = previous?.user.id === user.id && previous.serverUrl === url ? previous.household : null;
        const next: Account = { serverUrl: url, user, household: keep ?? (households.length === 1 ? { id: households[0].id, name: households[0].name, role: households[0].role } : null) };
        if (!keep) {
          ledger.current = {};
          since.current = null;
          await clearSyncState();
        }
        await saveAccount(next);
        setAccount(next);
        setStatus({ syncing: false, refused: 0 });
      },
      signOut: async () => {
        await client().logout().catch(() => {});
        await setToken(null);
        token.current = null;
        setAccount(null);
        setPush(null);
        setStatus({ syncing: false, refused: 0 });
      },
      households: () => client().households(),
      chooseHousehold: switchHousehold,
      createHousehold: async (name) => switchHousehold(await client().createHousehold(name)),
      members: loadMembers,
      invite: async (email) => {
        await client().invite(accountRef.current!.household!.id, email.trim());
      },
      join: async (link) => switchHousehold(await client().acceptInvite(link)),
      syncNow: () => schedule(0),
    }),
    [account, loaded, status, push, client, switchHousehold, loadMembers, schedule],
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncValue {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSync must be used inside SyncProvider');
  return ctx;
}

