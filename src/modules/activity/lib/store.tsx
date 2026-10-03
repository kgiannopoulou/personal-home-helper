import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { adapt, type Adaptation } from './coach';
import { newId, toDateKey } from '../../../shared/dates';
import { workoutKcal } from './fitness';
import { DEFAULT_STATE, loadState, saveState } from './storage';
import type { AppState, Feeling, Intensity, Profile, SleepEntry, TrainingSchedule, WorkoutType } from './types';

interface Store {
  state: AppState;
  ready: boolean;
  /** Apply changes from the server on top of the current state (src/shared/sync) */
  applySync: (fn: (s: AppState) => AppState) => void;
  setProfile: (p: Profile) => void;
  setSchedule: (s: TrainingSchedule) => void;
  addWorkout: (w: { type: WorkoutType; minutes: number; intensity: Intensity; notes?: string }) => void;
  removeWorkout: (id: string) => void;
  addSleep: (s: Omit<SleepEntry, 'id'>) => void;
  removeSleep: (id: string) => void;
  addWeight: (kg: number) => void;
  removeWeight: (id: string) => void;
  /** Adds steps to today's count (used by the live pedometer) */
  addSteps: (delta: number) => void;
  /** Overwrites a day's step count (manual entry or iOS history) */
  setSteps: (date: string, steps: number) => void;
  /** Records a coached run at `level`, adapts the plan and logs it as a workout */
  finishCoachSession: (level: number, completed: boolean, feeling: Feeling, minutes: number) => Adaptation;
  setCoachLevel: (level: number) => void;
}

const StoreContext = createContext<Store | null>(null);

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

  const weight = () => stateRef.current.profile?.weightKg ?? 70;

  const setProfile = useCallback((profile: Profile) => setState((s) => ({ ...s, profile })), []);
  const setSchedule = useCallback((schedule: TrainingSchedule) => setState((s) => ({ ...s, schedule })), []);

  const addWorkout = useCallback<Store['addWorkout']>((w) => {
    const kcal = workoutKcal(w.type, w.intensity, w.minutes, weight());
    setState((s) => ({ ...s, workouts: [...s.workouts, { ...w, kcal, id: newId(), date: toDateKey(), source: 'manual' }] }));
  }, []);
  const removeWorkout = useCallback(
    (id: string) => setState((s) => ({ ...s, workouts: s.workouts.filter((w) => w.id !== id) })),
    [],
  );

  const addSleep = useCallback(
    (entry: Omit<SleepEntry, 'id'>) =>
      // One entry per night: replace any existing entry for that morning.
      setState((s) => ({ ...s, sleep: [...s.sleep.filter((x) => x.date !== entry.date), { ...entry, id: newId() }] })),
    [],
  );
  const removeSleep = useCallback((id: string) => setState((s) => ({ ...s, sleep: s.sleep.filter((x) => x.id !== id) })), []);

  const addWeight = useCallback((kg: number) => {
    const date = toDateKey();
    setState((s) => ({
      ...s,
      weights: [...s.weights.filter((w) => w.date !== date), { id: newId(), date, kg }],
      profile: s.profile ? { ...s.profile, weightKg: kg } : s.profile,
    }));
  }, []);
  const removeWeight = useCallback(
    (id: string) => setState((s) => ({ ...s, weights: s.weights.filter((w) => w.id !== id) })),
    [],
  );

  const addSteps = useCallback((delta: number) => {
    if (delta <= 0) return;
    const date = toDateKey();
    setState((s) => ({ ...s, steps: { ...s.steps, [date]: (s.steps[date] ?? 0) + delta } }));
  }, []);
  const setSteps = useCallback(
    (date: string, steps: number) => setState((s) => ({ ...s, steps: { ...s.steps, [date]: Math.max(0, Math.round(steps)) } })),
    [],
  );

  const finishCoachSession = useCallback<Store['finishCoachSession']>((level, completed, feeling, minutes) => {
    // The runner may have made today's run easier or harder, so adapt from the level actually run.
    const result = adapt({ ...stateRef.current.coach, level }, completed, feeling);
    const date = toDateKey();
    const session = { id: newId(), date, level, completed, feeling };
    const kcal = workoutKcal('run', 'easy', minutes, weight());
    setState((s) => ({
      ...s,
      coach: { level: result.level, sessions: [...s.coach.sessions, session] },
      workouts:
        minutes > 0
          ? [...s.workouts, { id: newId(), date, type: 'run', minutes, intensity: 'easy', kcal, source: 'coach', notes: `Coach level ${session.level}` }]
          : s.workouts,
    }));
    return result;
  }, []);

  const setCoachLevel = useCallback(
    (level: number) => setState((s) => ({ ...s, coach: { ...s.coach, level } })),
    [],
  );

  const applySync = useCallback((fn: (s: AppState) => AppState) => {
    const next = fn(stateRef.current);
    stateRef.current = next;
    setState(next);
  }, []);

  const value = useMemo(
    () => ({
      state,
      ready,
      applySync,
      setProfile,
      setSchedule,
      addWorkout,
      removeWorkout,
      addSleep,
      removeSleep,
      addWeight,
      removeWeight,
      addSteps,
      setSteps,
      finishCoachSession,
      setCoachLevel,
    }),
    [state, ready, applySync, setProfile, setSchedule, addWorkout, removeWorkout, addSleep, removeSleep, addWeight, removeWeight, addSteps, setSteps, finishCoachSession, setCoachLevel],
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside <StoreProvider>');
  return store;
}
