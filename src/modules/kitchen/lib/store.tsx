import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { newId, toDateKey } from '../../../shared/dates';
import { normalizeName } from '../../../shared/homeCore';
import { addDays, findItem, newItem, restock, type Command } from './inventory';
import type { Receipt } from './receiptAI';
import { syncExpiryReminders } from './reminders';
import { DEFAULT_STATE, loadState, saveState } from './storage';
import type { AppState, InventoryItem, Level, Settings } from './types';

type NewItemOptions = Partial<Pick<InventoryItem, 'category' | 'location' | 'quantity' | 'price' | 'expiresAt'>> & {
  shelfLifeDays?: number;
};

export interface StockUpdate {
  name: string;
  level: Level;
  location?: InventoryItem['location'];
  category?: InventoryItem['category'];
  shelfLifeDays?: number;
}

interface Store {
  state: AppState;
  ready: boolean;
  /** Adds a new item, or restocks it if it already exists */
  addItem: (name: string, opts?: NewItemOptions) => void;
  updateItem: (id: string, patch: Partial<InventoryItem>) => void;
  setLevel: (id: string, level: Level) => void;
  removeItem: (id: string) => void;
  /** Applies a parsed sentence like "I finished the milk". Returns a short summary. */
  runCommand: (cmd: Command) => string;
  addReceipt: (items: Receipt['items']) => number;
  /** What a photo shows: sets levels of known items and adds new ones. Returns a short summary. */
  applyStock: (items: StockUpdate[]) => string;
  addToBuy: (name: string) => void;
  removeToBuy: (name: string) => void;
  clearToBuy: () => void;
  setSettings: (s: Settings) => void;
}

const StoreContext = createContext<Store | null>(null);

const addUnique = (list: string[], name: string) =>
  list.some((n) => normalizeName(n) === normalizeName(name)) ? list : [...list, name];

/** Items bought again are no longer needed on the to-buy list. */
const withoutName = (list: string[], name: string) => list.filter((n) => normalizeName(n) !== normalizeName(name));

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(DEFAULT_STATE);
  const [ready, setReady] = useState(false);
  const loaded = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    loadState().then((s) => {
      setState(s);
      loaded.current = true;
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (loaded.current) saveState(state).catch((e) => console.warn('Could not save state', e));
  }, [state]);

  // Reschedule expiry notifications shortly after items change.
  useEffect(() => {
    if (!loaded.current) return;
    const t = setTimeout(() => {
      syncExpiryReminders(state.items, state.settings.expiryReminders).catch((e) => console.warn('Reminders', e));
    }, 1500);
    return () => clearTimeout(t);
  }, [state.items, state.settings.expiryReminders]);

  const upsert = (s: AppState, name: string, opts: NewItemOptions = {}): AppState => {
    const today = toDateKey();
    const existing = findItem(s.items, name);
    const { shelfLifeDays, ...rest } = opts;
    if (existing && normalizeName(existing.name) === normalizeName(name)) {
      const location = rest.location ?? existing.location;
      const expiresAt = rest.expiresAt ?? (shelfLifeDays ? addDays(today, shelfLifeDays) : undefined);
      const updated = restock(existing, today, { ...rest, location, ...(expiresAt ? { expiresAt } : {}) });
      return { ...s, items: s.items.map((i) => (i.id === existing.id ? updated : i)), toBuy: withoutName(s.toBuy, name) };
    }
    return {
      ...s,
      items: [...s.items, newItem(name, { ...rest, shelfLifeDays, id: newId(), today })],
      toBuy: withoutName(s.toBuy, name),
    };
  };

  const setLevelIn = (s: AppState, id: string, level: Level): AppState => {
    const item = s.items.find((i) => i.id === id);
    if (!item) return s;
    const toBuy = s.settings.autoAddLow && (level === 'low' || level === 'empty') ? addUnique(s.toBuy, item.name) : s.toBuy;
    return { ...s, toBuy, items: s.items.map((i) => (i.id === id ? { ...i, level } : i)) };
  };

  const addItem = useCallback((name: string, opts?: NewItemOptions) => setState((s) => upsert(s, name, opts)), []);
  const updateItem = useCallback(
    (id: string, patch: Partial<InventoryItem>) =>
      setState((s) => ({ ...s, items: s.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) })),
    [],
  );
  const setLevel = useCallback((id: string, level: Level) => setState((s) => setLevelIn(s, id, level)), []);
  const removeItem = useCallback((id: string) => setState((s) => ({ ...s, items: s.items.filter((i) => i.id !== id) })), []);

  const runCommand = useCallback((cmd: Command): string => {
    let s = stateRef.current;
    const done: string[] = [];
    for (const name of cmd.names) {
      if (cmd.action === 'bought') {
        s = upsert(s, name);
        done.push(`✓ ${name} restocked`);
        continue;
      }
      const item = findItem(s.items, name);
      if (item) {
        s = setLevelIn(s, item.id, cmd.action);
        const added = s.toBuy.some((n) => normalizeName(n) === normalizeName(item.name)) && (cmd.action === 'empty' || cmd.action === 'low');
        done.push(`✓ ${item.name} → ${cmd.action}${added ? ', added to shopping' : ''}`);
      } else if (cmd.action === 'empty' || cmd.action === 'low') {
        // Not tracked yet, but clearly needed.
        s = { ...s, toBuy: addUnique(s.toBuy, name) };
        done.push(`🛒 ${name} added to shopping`);
      } else {
        done.push(`? ${name} isn't in your inventory`);
      }
    }
    setState(s);
    return done.join('\n');
  }, []);

  const addReceipt = useCallback((items: Receipt['items']) => {
    let s = stateRef.current;
    for (const r of items) {
      s = upsert(s, r.name, {
        category: r.category,
        location: r.location,
        quantity: r.quantity || undefined,
        price: r.price || undefined,
        shelfLifeDays: r.shelf_life_days > 0 ? r.shelf_life_days : undefined,
      });
    }
    setState(s);
    return items.length;
  }, []);

  const applyStock = useCallback((items: StockUpdate[]): string => {
    let s = stateRef.current;
    const done: string[] = [];
    for (const u of items) {
      const item = findItem(s.items, u.name);
      if (item) {
        if (item.level !== u.level) {
          s = setLevelIn(s, item.id, u.level);
          done.push(`${item.name} → ${u.level}`);
        }
        continue;
      }
      if (u.level === 'empty') continue;
      s = upsert(s, u.name, { location: u.location, category: u.category, shelfLifeDays: u.shelfLifeDays || undefined });
      const added = findItem(s.items, u.name);
      if (added && u.level !== 'full') s = setLevelIn(s, added.id, u.level);
      done.push(`added ${u.name}${u.level !== 'full' ? ` (${u.level})` : ''}`);
    }
    stateRef.current = s;
    setState(s);
    return done.length ? done.join(', ') : 'nothing new';
  }, []);

  const addToBuy = useCallback((name: string) => setState((s) => ({ ...s, toBuy: addUnique(s.toBuy, name.trim()) })), []);
  const removeToBuy = useCallback((name: string) => setState((s) => ({ ...s, toBuy: withoutName(s.toBuy, name) })), []);
  const clearToBuy = useCallback(() => setState((s) => ({ ...s, toBuy: [] })), []);
  const setSettings = useCallback((settings: Settings) => setState((s) => ({ ...s, settings })), []);

  const value = useMemo(
    () => ({ state, ready, addItem, updateItem, setLevel, removeItem, runCommand, addReceipt, applyStock, addToBuy, removeToBuy, clearToBuy, setSettings }),
    [state, ready, addItem, updateItem, setLevel, removeItem, runCommand, addReceipt, applyStock, addToBuy, removeToBuy, clearToBuy, setSettings],
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside <StoreProvider>');
  return store;
}

