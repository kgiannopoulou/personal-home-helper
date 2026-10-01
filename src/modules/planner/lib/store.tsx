import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { calendarSupported, loadPhoneEvents } from './calendar';
import { newId } from '../../../shared/dates';
import { syncBriefings } from './notifications';
import { completeAdmin, type BriefingInput } from './planner';
import { DEFAULT_STATE, loadState, saveState } from './storage';
import type { AdminItem, AppState, CalEvent, Person, Settings, Todo } from './types';

interface Store {
  state: AppState;
  ready: boolean;
  /** Phone calendar events + events added in the app */
  events: CalEvent[];
  calendarError: string | null;
  refreshCalendar: () => Promise<void>;
  briefingInput: BriefingInput;
  addEvent: (e: Omit<CalEvent, 'id' | 'source'>) => void;
  removeEvent: (id: string) => void;
  addTodo: (t: Omit<Todo, 'id' | 'createdAt'>) => void;
  toggleTodo: (id: string) => void;
  removeTodo: (id: string) => void;
  addAdmin: (a: Omit<AdminItem, 'id' | 'history'>) => void;
  completeAdminItem: (id: string) => void;
  removeAdmin: (id: string) => void;
  addPerson: (p: Omit<Person, 'id' | 'ideas'>) => void;
  updatePerson: (id: string, patch: Partial<Person>) => void;
  removePerson: (id: string) => void;
  toggleTripCheck: (tripKey: string, itemId: string) => void;
  setSettings: (s: Settings) => void;
}

const StoreContext = createContext<Store | null>(null);
const DAY = 24 * 60 * 60 * 1000;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(DEFAULT_STATE);
  const [ready, setReady] = useState(false);
  const [phoneEvents, setPhoneEvents] = useState<CalEvent[]>([]);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const loaded = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  const refreshCalendar = useCallback(async () => {
    if (!calendarSupported) return;
    try {
      // Last month (for reviews) to two months ahead (trips, birthdays).
      const now = Date.now();
      setPhoneEvents(await loadPhoneEvents(stateRef.current.settings.calendarIds, new Date(now - 35 * DAY), new Date(now + 62 * DAY)));
      setCalendarError(null);
    } catch (e) {
      console.warn('Could not read calendar', e);
      setCalendarError('Could not read your calendar. Check calendar permission in your phone settings.');
    }
  }, []);

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

  const events = useMemo(() => [...phoneEvents, ...state.manualEvents], [phoneEvents, state.manualEvents]);
  const briefingInput = useMemo<BriefingInput>(
    () => ({
      events,
      todos: state.todos,
      admin: state.admin,
      people: state.people,
      tripChecks: state.tripChecks,
      dayStart: state.settings.dayStart,
      dayEnd: state.settings.dayEnd,
    }),
    [events, state.todos, state.admin, state.people, state.tripChecks, state.settings.dayStart, state.settings.dayEnd],
  );

  // Keep the scheduled morning briefings in sync with the latest data (debounced).
  useEffect(() => {
    if (!ready) return;
    const { briefingEnabled, briefingHour, briefingMinute } = state.settings;
    const id = setTimeout(() => {
      syncBriefings(briefingInput, briefingEnabled, briefingHour, briefingMinute).catch((e) => console.warn('Could not schedule briefing', e));
    }, 1500);
    return () => clearTimeout(id);
  }, [ready, briefingInput, state.settings]);

  // Re-read the calendar when you pick different calendars.
  const calendarKey = JSON.stringify(state.settings.calendarIds);
  useEffect(() => {
    if (ready) refreshCalendar();
  }, [ready, calendarKey, refreshCalendar]);

  const commit = (next: AppState) => {
    stateRef.current = next;
    setState(next);
  };
  const update = (fn: (s: AppState) => AppState) => commit(fn(stateRef.current));

  const addEvent = useCallback((e: Omit<CalEvent, 'id' | 'source'>) => {
    update((s) => ({ ...s, manualEvents: [...s.manualEvents, { ...e, id: newId(), source: 'manual' }] }));
  }, []);
  const removeEvent = useCallback((id: string) => {
    update((s) => ({ ...s, manualEvents: s.manualEvents.filter((e) => e.id !== id) }));
  }, []);

  const addTodo = useCallback((t: Omit<Todo, 'id' | 'createdAt'>) => {
    update((s) => ({ ...s, todos: [...s.todos, { ...t, id: newId(), createdAt: new Date().toISOString() }] }));
  }, []);
  const toggleTodo = useCallback((id: string) => {
    update((s) => ({
      ...s,
      todos: s.todos.map((t) => (t.id === id ? { ...t, done: t.done ? undefined : new Date().toISOString() } : t)),
    }));
  }, []);
  const removeTodo = useCallback((id: string) => {
    update((s) => ({ ...s, todos: s.todos.filter((t) => t.id !== id) }));
  }, []);

  const addAdmin = useCallback((a: Omit<AdminItem, 'id' | 'history'>) => {
    update((s) => ({ ...s, admin: [...s.admin, { ...a, id: newId(), history: [] }] }));
  }, []);
  const completeAdminItem = useCallback((id: string) => {
    update((s) => ({ ...s, admin: s.admin.map((a) => (a.id === id ? completeAdmin(a) : a)) }));
  }, []);
  const removeAdmin = useCallback((id: string) => {
    update((s) => ({ ...s, admin: s.admin.filter((a) => a.id !== id) }));
  }, []);

  const addPerson = useCallback((p: Omit<Person, 'id' | 'ideas'>) => {
    update((s) => ({ ...s, people: [...s.people, { ...p, id: newId(), ideas: [] }] }));
  }, []);
  const updatePerson = useCallback((id: string, patch: Partial<Person>) => {
    update((s) => ({ ...s, people: s.people.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
  }, []);
  const removePerson = useCallback((id: string) => {
    update((s) => ({ ...s, people: s.people.filter((p) => p.id !== id) }));
  }, []);

  const toggleTripCheck = useCallback((tripKey: string, itemId: string) => {
    update((s) => {
      const list = s.tripChecks[tripKey] ?? [];
      const next = list.includes(itemId) ? list.filter((x) => x !== itemId) : [...list, itemId];
      return { ...s, tripChecks: { ...s.tripChecks, [tripKey]: next } };
    });
  }, []);

  const setSettings = useCallback((settings: Settings) => update((s) => ({ ...s, settings })), []);

  const value = useMemo(
    () => ({
      state,
      ready,
      events,
      calendarError,
      refreshCalendar,
      briefingInput,
      addEvent,
      removeEvent,
      addTodo,
      toggleTodo,
      removeTodo,
      addAdmin,
      completeAdminItem,
      removeAdmin,
      addPerson,
      updatePerson,
      removePerson,
      toggleTripCheck,
      setSettings,
    }),
    [state, ready, events, calendarError, refreshCalendar, briefingInput, addEvent, removeEvent, addTodo, toggleTodo, removeTodo, addAdmin, completeAdminItem, removeAdmin, addPerson, updatePerson, removePerson, toggleTripCheck, setSettings],
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside <StoreProvider>');
  return store;
}
