import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { newId, toDateKey } from '../../../shared/dates';
import { categorize, normalizeName, type ShoppingImport } from '../../../shared/homeCore';
import { DEFAULT_STATE, loadState, saveState } from './storage';
import type { AppState, ListItem, Settings } from './types';

interface Store {
  state: AppState;
  ready: boolean;
  /** Apply changes from the server on top of the current state (src/shared/sync) */
  applySync: (fn: (s: AppState) => AppState) => void;
  addItems: (items: { name: string; quantity?: string }[], source?: ListItem['source']) => number;
  updateItem: (id: string, patch: Partial<ListItem>) => void;
  toggle: (id: string) => void;
  removeItem: (id: string) => void;
  /** Saves the trip, learns prices of checked items and clears them from the list */
  finishTrip: (total: number, store?: string) => void;
  /** Handles a link from Kitchen Inventory */
  importData: (data: ShoppingImport) => { added: number; spend?: number };
  /** Logs a purchase that didn't go through the list */
  addTrip: (total: number, store?: string) => void;
  removeTrip: (id: string) => void;
  setSettings: (s: Settings) => void;
}

const StoreContext = createContext<Store | null>(null);

function addTo(s: AppState, items: { name: string; quantity?: string }[], source: ListItem['source']): { state: AppState; added: number } {
  const list = [...s.items];
  const history = { ...s.history };
  let added = 0;
  for (const { name, quantity } of items) {
    const clean = name.trim();
    if (!clean) continue;
    const key = normalizeName(clean);
    history[key] = { name: clean, count: (history[key]?.count ?? 0) + 1 };
    const existing = list.findIndex((i) => normalizeName(i.name) === key);
    if (existing >= 0) {
      // Already on the list: un-tick it rather than adding a duplicate.
      list[existing] = { ...list[existing], checked: false, quantity: quantity ?? list[existing].quantity };
      continue;
    }
    list.push({ id: newId(), name: clean, quantity, category: categorize(clean), checked: false, addedAt: new Date().toISOString(), source });
    added++;
  }
  return { state: { ...s, items: list, history }, added };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(DEFAULT_STATE);
  const [ready, setReady] = useState(false);
  const loaded = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    loadState().then((s) => {
      setState(s);
      stateRef.current = s;
      loaded.current = true;
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (loaded.current) saveState(state).catch((e) => console.warn('Could not save state', e));
  }, [state]);

  const commit = (next: AppState) => {
    stateRef.current = next;
    setState(next);
  };

  const addItems = useCallback((items: { name: string; quantity?: string }[], source: ListItem['source'] = 'manual') => {
    const { state: next, added } = addTo(stateRef.current, items, source);
    commit(next);
    return added;
  }, []);

  const updateItem = useCallback((id: string, patch: Partial<ListItem>) => {
    const s = stateRef.current;
    const prices = { ...s.prices };
    const item = s.items.find((i) => i.id === id);
    if (item && patch.price !== undefined) prices[normalizeName(item.name)] = patch.price;
    commit({ ...s, prices, items: s.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) });
  }, []);

  const toggle = useCallback((id: string) => {
    const s = stateRef.current;
    commit({ ...s, items: s.items.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i)) });
  }, []);

  const removeItem = useCallback((id: string) => {
    const s = stateRef.current;
    commit({ ...s, items: s.items.filter((i) => i.id !== id) });
  }, []);

  const finishTrip = useCallback((total: number, store?: string) => {
    const s = stateRef.current;
    const bought = s.items.filter((i) => i.checked);
    const prices = { ...s.prices };
    for (const i of bought) if (i.price !== undefined) prices[normalizeName(i.name)] = i.price;
    const trips =
      total > 0
        ? [...s.trips, { id: newId(), date: toDateKey(), total, store, itemCount: bought.length, source: 'manual' as const }]
        : s.trips;
    commit({ ...s, prices, trips, items: s.items.filter((i) => !i.checked) });
  }, []);

  const importData = useCallback((data: ShoppingImport) => {
    let s = stateRef.current;
    const { state: next, added } = addTo(s, data.items.map((name) => ({ name })), 'inventory');
    s = next;
    if (data.spend !== undefined) {
      s = {
        ...s,
        trips: [...s.trips, { id: newId(), date: data.date ?? toDateKey(), total: data.spend, store: data.store, itemCount: 0, source: 'receipt' }],
      };
    }
    commit(s);
    return { added, spend: data.spend };
  }, []);

  const addTrip = useCallback((total: number, store?: string) => {
    const s = stateRef.current;
    commit({ ...s, trips: [...s.trips, { id: newId(), date: toDateKey(), total, store, itemCount: 0, source: 'manual' }] });
  }, []);

  const removeTrip = useCallback((id: string) => {
    const s = stateRef.current;
    commit({ ...s, trips: s.trips.filter((t) => t.id !== id) });
  }, []);

  const setSettings = useCallback((settings: Settings) => commit({ ...stateRef.current, settings }), []);

  const applySync = useCallback((fn: (s: AppState) => AppState) => commit(fn(stateRef.current)), []);

  const value = useMemo(
    () => ({ state, ready, applySync, addItems, updateItem, toggle, removeItem, finishTrip, importData, addTrip, removeTrip, setSettings }),
    [state, ready, applySync, addItems, updateItem, toggle, removeItem, finishTrip, importData, addTrip, removeTrip, setSettings],
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside <StoreProvider>');
  return store;
}
