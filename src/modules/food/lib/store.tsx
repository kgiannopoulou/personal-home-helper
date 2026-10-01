import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { DEFAULT_STATE, loadState, saveState } from './storage';
import type { AppState, FoodEntry, Profile, ReminderSettings, WaterEntry } from './types';
import { newId, toDateKey } from '../../../shared/dates';

interface Store {
  state: AppState;
  ready: boolean;
  setProfile: (p: Profile) => void;
  setReminders: (r: ReminderSettings) => void;
  addFood: (entry: Omit<FoodEntry, 'id' | 'date' | 'time'>) => void;
  removeFood: (id: string) => void;
  addWater: (ml: number, drink?: WaterEntry['drink']) => void;
  removeWater: (id: string) => void;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(DEFAULT_STATE);
  const [ready, setReady] = useState(false);
  const loaded = useRef(false);

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

  const stamp = () => {
    const now = new Date();
    return { id: newId(), date: toDateKey(now), time: now.toISOString() };
  };

  const setProfile = useCallback((profile: Profile) => setState((s) => ({ ...s, profile })), []);
  const setReminders = useCallback((reminders: ReminderSettings) => setState((s) => ({ ...s, reminders })), []);
  const addFood = useCallback(
    (entry: Omit<FoodEntry, 'id' | 'date' | 'time'>) =>
      setState((s) => ({ ...s, foods: [...s.foods, { ...entry, ...stamp() }] })),
    [],
  );
  const removeFood = useCallback(
    (id: string) => setState((s) => ({ ...s, foods: s.foods.filter((f) => f.id !== id) })),
    [],
  );
  const addWater = useCallback(
    (ml: number, drink: WaterEntry['drink'] = 'water') =>
      setState((s) => ({ ...s, water: [...s.water, { ml, drink, ...stamp() }] })),
    [],
  );
  const removeWater = useCallback(
    (id: string) => setState((s) => ({ ...s, water: s.water.filter((w) => w.id !== id) })),
    [],
  );

  const value = useMemo(
    () => ({ state, ready, setProfile, setReminders, addFood, removeFood, addWater, removeWater }),
    [state, ready, setProfile, setReminders, addFood, removeFood, addWater, removeWater],
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside <StoreProvider>');
  return store;
}
