import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { fairAssign, findSupply, laundryStatus } from './chores';
import { newId, toDateKey } from '../../../shared/dates';
import { categorize } from '../../../shared/homeCore';
import { cancelNotification, scheduleLaundry } from './notifications';
import { EMPTY_STATE, loadState, saveState } from './storage';
import type { AppState, LaundryType, Room, Settings, SupplyLevel, Task } from './types';

interface Store {
  state: AppState;
  ready: boolean;
  /** Apply changes from the server on top of the current state (src/shared/sync) */
  applySync: (fn: (s: AppState) => AppState) => void;
  completeTask: (id: string) => void;
  undoTask: (id: string) => void;
  addTask: (t: Omit<Task, 'id'>) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;
  removeTask: (id: string) => void;
  addRoom: (r: Omit<Room, 'id'>) => void;
  removeRoom: (id: string) => void;
  pinToday: (taskId: string) => void;
  setSupplyLevel: (name: string, level: SupplyLevel) => void;
  removeSupply: (id: string) => void;
  addMember: (name: string) => void;
  removeMember: (id: string) => void;
  setMe: (id: string) => void;
  shareFairly: () => void;
  startLaundry: (type: LaundryType, minutes: number) => Promise<void>;
  finishLaundry: () => void;
  setSettings: (s: Settings) => void;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(EMPTY_STATE);
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

  const completeTask = useCallback((id: string) => {
    const s = stateRef.current;
    const task = s.tasks.find((t) => t.id === id);
    if (!task) return;
    const at = new Date().toISOString();
    commit({
      ...s,
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, lastDone: at } : t)),
      completions: [...s.completions, { id: newId(), taskId: id, at, by: s.meId, minutes: task.minutes }].slice(-1000),
    });
  }, []);

  const undoTask = useCallback((id: string) => {
    const s = stateRef.current;
    const mine = s.completions.filter((c) => c.taskId === id);
    if (!mine.length) return;
    const last = mine[mine.length - 1];
    const previous = mine.length > 1 ? mine[mine.length - 2].at : undefined;
    commit({
      ...s,
      completions: s.completions.filter((c) => c.id !== last.id),
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, lastDone: previous } : t)),
    });
  }, []);

  const addTask = useCallback((t: Omit<Task, 'id'>) => {
    const s = stateRef.current;
    commit({ ...s, tasks: [...s.tasks, { ...t, id: newId() }] });
  }, []);

  const updateTask = useCallback((id: string, patch: Partial<Task>) => {
    const s = stateRef.current;
    commit({ ...s, tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) });
  }, []);

  const removeTask = useCallback((id: string) => {
    const s = stateRef.current;
    commit({ ...s, tasks: s.tasks.filter((t) => t.id !== id), completions: s.completions.filter((c) => c.taskId !== id) });
  }, []);

  const addRoom = useCallback((r: Omit<Room, 'id'>) => {
    const s = stateRef.current;
    commit({ ...s, rooms: [...s.rooms, { ...r, id: newId() }] });
  }, []);

  const removeRoom = useCallback((id: string) => {
    const s = stateRef.current;
    const gone = new Set(s.tasks.filter((t) => t.roomId === id).map((t) => t.id));
    commit({
      ...s,
      rooms: s.rooms.filter((r) => r.id !== id),
      tasks: s.tasks.filter((t) => !gone.has(t.id)),
      completions: s.completions.filter((c) => !gone.has(c.taskId)),
    });
  }, []);

  const pinToday = useCallback((taskId: string) => {
    const s = stateRef.current;
    const today = toDateKey();
    const ids = s.pinned.date === today ? s.pinned.taskIds : [];
    if (ids.includes(taskId)) return;
    commit({ ...s, pinned: { date: today, taskIds: [...ids, taskId] } });
  }, []);

  const setSupplyLevel = useCallback((name: string, level: SupplyLevel) => {
    const s = stateRef.current;
    const existing = findSupply(s.supplies, name);
    const supplies = existing
      ? s.supplies.map((x) => (x.id === existing.id ? { ...x, level } : x))
      : [...s.supplies, { id: newId(), name: name.trim(), category: categorize(name), level }];
    commit({ ...s, supplies });
  }, []);

  const removeSupply = useCallback((id: string) => {
    const s = stateRef.current;
    commit({ ...s, supplies: s.supplies.filter((x) => x.id !== id) });
  }, []);

  const addMember = useCallback((name: string) => {
    const s = stateRef.current;
    const member = { id: newId(), name: name.trim() };
    // The first person added is assumed to be the one holding the phone.
    commit({ ...s, members: [...s.members, member], meId: s.meId ?? member.id });
  }, []);

  const removeMember = useCallback((id: string) => {
    const s = stateRef.current;
    const members = s.members.filter((m) => m.id !== id);
    commit({
      ...s,
      members,
      meId: s.meId === id ? members[0]?.id : s.meId,
      tasks: s.tasks.map((t) => (t.assignee === id ? { ...t, assignee: undefined } : t)),
    });
  }, []);

  const setMe = useCallback((id: string) => commit({ ...stateRef.current, meId: id }), []);

  const shareFairly = useCallback(() => {
    const s = stateRef.current;
    const personal = new Set(s.rooms.filter((r) => r.personal).map((r) => r.id));
    // Personal routines (skincare…) stay with whoever does them.
    const assignment = fairAssign(
      s.tasks.filter((t) => !personal.has(t.roomId)),
      s.members,
    );
    commit({ ...s, tasks: s.tasks.map((t) => (assignment[t.id] ? { ...t, assignee: assignment[t.id] } : t)) });
  }, []);

  const startLaundry = useCallback(async (type: LaundryType, minutes: number) => {
    const s = stateRef.current;
    await cancelNotification(s.laundry?.notificationId);
    const startedAt = new Date();
    const load = { type, minutes, startedAt: startedAt.toISOString() };
    commit({ ...stateRef.current, laundry: load });
    try {
      const notificationId = await scheduleLaundry(type, laundryStatus(load, startedAt).readyAt);
      if (notificationId && stateRef.current.laundry?.startedAt === load.startedAt) {
        commit({ ...stateRef.current, laundry: { ...load, notificationId } });
      }
    } catch (e) {
      console.warn('Could not schedule laundry reminder', e);
    }
  }, []);

  const finishLaundry = useCallback(() => {
    const s = stateRef.current;
    cancelNotification(s.laundry?.notificationId).catch(() => {});
    commit({ ...s, laundry: null });
  }, []);

  const setSettings = useCallback((settings: Settings) => commit({ ...stateRef.current, settings }), []);

  const applySync = useCallback((fn: (s: AppState) => AppState) => commit(fn(stateRef.current)), []);

  const value = useMemo(
    () => ({
      state,
      ready,
      applySync,
      completeTask,
      undoTask,
      addTask,
      updateTask,
      removeTask,
      addRoom,
      removeRoom,
      pinToday,
      setSupplyLevel,
      removeSupply,
      addMember,
      removeMember,
      setMe,
      shareFairly,
      startLaundry,
      finishLaundry,
      setSettings,
    }),
    [state, ready, applySync, completeTask, undoTask, addTask, updateTask, removeTask, addRoom, removeRoom, pinToday, setSupplyLevel, removeSupply, addMember, removeMember, setMe, shareFairly, startLaundry, finishLaundry, setSettings],
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside <StoreProvider>');
  return store;
}
