import * as Notifications from 'expo-notifications';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { useStore as useActivity } from '../../activity/lib/store';
import { useStore as useChores } from '../../chores/lib/store';
import { useStore as useFood } from '../../food/lib/store';
import { getApiKey } from '../../kitchen/lib/storage';
import { useStore as useKitchen } from '../../kitchen/lib/store';
import { useStore as useMoney } from '../../money/lib/store';
import { useStore as usePlanner } from '../../planner/lib/store';
import { useStore as useShopping } from '../../shopping/lib/store';
import { cancelScheduled, notificationId } from '../../../shared/notify';
import { toDateKey } from '../../../shared/dates';
import { useHub } from '../../../shared/useHub';
import { useAssistantActions } from './actions';
import { AssistantError } from './assistant';
import { loadMemory, loadProactive, saveProactive, type Proactive as Saved } from './chat';
import { todayContext } from './context';
import { memoryText } from './memory';
import { applyPlan } from './plan';
import { briefingTarget, makeBriefing, makeReview, nudgeLines, reviewWeek, type DailyBriefing, type ProactiveInput, type WeeklyReview } from './proactive';

interface ProactiveStore {
  /** Today's nudges, or tomorrow's once they're written in the evening */
  briefing: DailyBriefing | null;
  /** The weekly review, on Sunday and Monday */
  review: WeeklyReview | null;
  working: 'briefing' | 'review' | null;
  error: string | null;
  /** Write today's nudges again */
  refreshBriefing: () => void;
  /** Applies the chosen changes of the review's plan */
  applyReviewPlan: (indexes: number[]) => void;
}

const Context = createContext<ProactiveStore | null>(null);

/**
 * The assistant without being asked: 3 nudges a day (one cheap call, cached for the day, also put
 * in the morning notification) and a weekly review with a plan for next week on Sunday.
 */
export function ProactiveProvider({ children }: { children: ReactNode }) {
  const hub = useHub();
  const actions = useAssistantActions();
  const planner = usePlanner();
  const ready = [useFood().ready, useActivity().ready, useKitchen().ready, useShopping().ready, useMoney().ready, useChores().ready, planner.ready].every(Boolean);

  const [saved, setSaved] = useState<Saved | null>(null);
  const [working, setWorking] = useState<ProactiveStore['working']>(null);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef({ hub, actions });
  latest.current = { hub, actions };
  const savedRef = useRef<Saved | null>(null);
  /** Days and weeks already tried this session, so a failure doesn't retry every minute */
  const tried = useRef(new Set<string>());

  const commit = useCallback((next: Saved) => {
    savedRef.current = next;
    setSaved(next);
    saveProactive(next).catch((e) => console.warn('Could not save briefing', e));
  }, []);

  useEffect(() => {
    loadProactive().then((p) => {
      savedRef.current = p;
      setSaved(p);
    });
  }, []);

  // The nudges go into the planner's morning notification for their day.
  const { setBriefingExtras } = planner;
  useEffect(() => {
    if (saved) setBriefingExtras(Object.fromEntries(saved.briefings.map((b) => [b.date, nudgeLines(b)])));
  }, [saved, setBriefingExtras]);

  // A reminder every Sunday evening to read the review.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    (async () => {
      const { granted } = await Notifications.getPermissionsAsync();
      if (!granted) return;
      await cancelScheduled('assistant-');
      await Notifications.scheduleNotificationAsync({
        identifier: notificationId('assistant-'),
        content: { title: '📋 Your weekly review', body: 'See how your week went and tap Apply on a plan for next week.' },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: 1, hour: 18, minute: 0 },
      });
    })().catch((e) => console.warn('Could not schedule the weekly review', e));
  }, []);

  const gather = useCallback(async (forReview: boolean): Promise<ProactiveInput> => {
    const { hub: h, actions: a } = latest.current;
    const days = forReview ? 7 : 28;
    return {
      today: todayContext(h),
      calendarWeek: a.lookUp('calendar_week'),
      forecast: a.lookUp('forecast'),
      ...(forReview ? { kitchen: a.lookUp('kitchen'), chores: a.lookUp('chores'), foodWeek: a.lookUp('food_week') } : {}),
      history: {
        money: a.lookUpHistory('money', days),
        food: a.lookUpHistory('food', days),
        activity: a.lookUpHistory('activity', days),
        chores: a.lookUpHistory('chores', forReview ? 14 : 28),
      },
      memory: memoryText(await loadMemory()),
    };
  }, []);

  const run = useCallback(
    async (force = false) => {
      const now = new Date();
      const key = await getApiKey();
      if (!key || !savedRef.current) return;
      const target = briefingTarget(now);
      const hasBriefing = savedRef.current.briefings.some((b) => b.date === target.date);
      if ((force || !hasBriefing) && (force || !tried.current.has(`b${target.date}`))) {
        tried.current.add(`b${target.date}`);
        setWorking('briefing');
        try {
          const b = await makeBriefing(key, await gather(false), now);
          const cur = savedRef.current!;
          commit({ ...cur, briefings: [...cur.briefings.filter((x) => x.date !== b.date), b] });
          setError(null);
        } catch (e) {
          setError(e instanceof AssistantError ? e.message : 'Could not write today’s nudges.');
          console.warn('Briefing failed', e);
        }
      }
      const week = reviewWeek(now);
      if (week && savedRef.current!.review?.week !== week && !tried.current.has(`r${week}`)) {
        tried.current.add(`r${week}`);
        setWorking('review');
        try {
          const review = await makeReview(key, await gather(true), week, now);
          commit({ ...savedRef.current!, review });
        } catch (e) {
          console.warn('Weekly review failed', e);
        }
      }
      setWorking(null);
    },
    [commit, gather],
  );

  // Once all data has loaded, and again when the day changes while the app is open.
  const today = toDateKey(hub.now);
  const evening = hub.now.getHours() >= 17;
  useEffect(() => {
    if (ready && saved && !working) run().catch((e) => console.warn(e));
  }, [ready, !!saved, today, evening]);

  const value = useMemo<ProactiveStore>(() => {
    const todayKey = toDateKey(hub.now);
    const briefings = saved?.briefings ?? [];
    // In the evening tomorrow's nudges take over once written.
    const briefing = [...briefings].reverse().find((b) => b.date >= todayKey) ?? null;
    const week = reviewWeek(hub.now);
    return {
      briefing,
      review: saved?.review && saved.review.week === week ? saved.review : null,
      working,
      error,
      refreshBriefing: () => {
        if (!working) run(true).catch((e) => console.warn(e));
      },
      applyReviewPlan: (indexes) => {
        const cur = savedRef.current;
        if (!cur?.review?.plan || cur.review.plan.applied) return;
        const plan = cur.review.plan;
        const applied = applyPlan(indexes.map((i) => plan.changes[i]), latest.current.actions);
        commit({ ...cur, review: { ...cur.review, plan: { ...plan, applied } } });
      },
    };
  }, [hub.now, saved, working, error, run, commit]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useProactive(): ProactiveStore {
  const store = useContext(Context);
  if (!store) throw new Error('useProactive must be used inside <ProactiveProvider>');
  return store;
}
