import { Pedometer } from 'expo-sensors';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { toDateKey } from '../../../shared/dates';
import { useStore } from './store';

export type StepSource = 'health' | 'live' | 'manual';

/**
 * Keeps today's step count up to date.
 * - iOS: reads the full day from the motion co-processor (works even if the app was closed).
 * - Android: counts live while the app is open and adds to the saved total.
 * - Web / no sensor: manual entry only.
 */
export function useTodaySteps(): { steps: number; source: StepSource } {
  const { state, ready, addSteps, setSteps } = useStore();
  const [source, setSource] = useState<StepSource>('manual');
  const last = useRef<number | null>(null);
  const today = toDateKey();

  useEffect(() => {
    if (!ready || Platform.OS === 'web') return;
    let sub: { remove: () => void } | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    (async () => {
      if (!(await Pedometer.isAvailableAsync())) return;
      const perm = await Pedometer.requestPermissionsAsync();
      if (!perm.granted || cancelled) return;

      if (Platform.OS === 'ios') {
        setSource('health');
        const refresh = async () => {
          const now = new Date();
          const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const { steps } = await Pedometer.getStepCountAsync(start, now);
          setSteps(toDateKey(now), steps);
        };
        await refresh();
        timer = setInterval(refresh, 60_000);
      } else {
        setSource('live');
        // watchStepCount reports steps since subscribing, so add only the difference.
        sub = Pedometer.watchStepCount(({ steps }) => {
          const delta = last.current === null ? steps : steps - last.current;
          last.current = steps;
          addSteps(delta);
        });
      }
    })().catch((e) => console.warn('Pedometer unavailable', e));

    return () => {
      cancelled = true;
      sub?.remove();
      if (timer) clearInterval(timer);
      last.current = null;
    };
  }, [ready, addSteps, setSteps]);

  return { steps: state.steps[today] ?? 0, source };
}
