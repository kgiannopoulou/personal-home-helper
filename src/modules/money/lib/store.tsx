import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { applyRecurring } from './budget';
import { newId, toDateKey } from '../../../shared/dates';
import { DEFAULT_STATE, loadState, saveState } from './storage';
import type { Appliance, AppState, Expense, Recurring, Reward, Settings } from './types';

type NewExpense = Omit<Expense, 'id' | 'source' | 'date'> & { date?: string; source?: Expense['source'] };

interface Store {
  state: AppState;
  ready: boolean;
  /** Apply changes from the server on top of the current state (src/shared/sync) */
  applySync: (fn: (s: AppState) => AppState) => void;
  addExpense: (e: NewExpense) => void;
  updateExpense: (id: string, patch: Partial<Expense>) => void;
  removeExpense: (id: string) => void;
  addRecurring: (r: Omit<Recurring, 'id'>) => void;
  removeRecurring: (id: string) => void;
  addReward: (r: Omit<Reward, 'id'>) => void;
  removeReward: (id: string) => void;
  addAppliance: (a: Omit<Appliance, 'id'>) => void;
  updateAppliance: (id: string, patch: Partial<Appliance>) => void;
  removeAppliance: (id: string) => void;
  setSettings: (s: Settings) => void;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(DEFAULT_STATE);
  const [ready, setReady] = useState(false);
  const loaded = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    loadState().then((saved) => {
      // Rent, subscriptions etc. whose day has come this month are added on start.
      const s = applyRecurring(saved);
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

  const addExpense = useCallback((e: NewExpense) => {
    const s = stateRef.current;
    commit({ ...s, expenses: [...s.expenses, { ...e, id: newId(), date: e.date ?? toDateKey(), source: e.source ?? 'manual' }] });
  }, []);

  const updateExpense = useCallback((id: string, patch: Partial<Expense>) => {
    const s = stateRef.current;
    commit({ ...s, expenses: s.expenses.map((e) => (e.id === id ? { ...e, ...patch } : e)) });
  }, []);

  const removeExpense = useCallback((id: string) => {
    const s = stateRef.current;
    commit({ ...s, expenses: s.expenses.filter((e) => e.id !== id) });
  }, []);

  const addRecurring = useCallback((r: Omit<Recurring, 'id'>) => {
    const s = stateRef.current;
    commit(applyRecurring({ ...s, recurring: [...s.recurring, { ...r, id: newId() }] }));
  }, []);

  const removeRecurring = useCallback((id: string) => {
    const s = stateRef.current;
    // Expenses already added stay: you did pay them.
    commit({ ...s, recurring: s.recurring.filter((r) => r.id !== id) });
  }, []);

  const addReward = useCallback((r: Omit<Reward, 'id'>) => {
    const s = stateRef.current;
    commit({ ...s, rewards: [...s.rewards, { ...r, id: newId() }] });
  }, []);

  const removeReward = useCallback((id: string) => {
    const s = stateRef.current;
    commit({ ...s, rewards: s.rewards.filter((r) => r.id !== id) });
  }, []);

  const addAppliance = useCallback((a: Omit<Appliance, 'id'>) => {
    const s = stateRef.current;
    commit({ ...s, appliances: [...s.appliances, { ...a, id: newId() }] });
  }, []);

  const updateAppliance = useCallback((id: string, patch: Partial<Appliance>) => {
    const s = stateRef.current;
    commit({ ...s, appliances: s.appliances.map((a) => (a.id === id ? { ...a, ...patch } : a)) });
  }, []);

  const removeAppliance = useCallback((id: string) => {
    const s = stateRef.current;
    commit({ ...s, appliances: s.appliances.filter((a) => a.id !== id) });
  }, []);

  const setSettings = useCallback((settings: Settings) => commit({ ...stateRef.current, settings }), []);

  const applySync = useCallback((fn: (s: AppState) => AppState) => commit(fn(stateRef.current)), []);

  const value = useMemo(
    () => ({
      state,
      ready,
      applySync,
      addExpense,
      updateExpense,
      removeExpense,
      addRecurring,
      removeRecurring,
      addReward,
      removeReward,
      addAppliance,
      updateAppliance,
      removeAppliance,
      setSettings,
    }),
    [state, ready, applySync, addExpense, updateExpense, removeExpense, addRecurring, removeRecurring, addReward, removeReward, addAppliance, updateAppliance, removeAppliance, setSettings],
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside <StoreProvider>');
  return store;
}
