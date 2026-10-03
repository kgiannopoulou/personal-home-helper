import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { useStore as useChores } from '../modules/chores/lib/store';
import { addDays } from '../modules/kitchen/lib/inventory';
import { useStore as useKitchen } from '../modules/kitchen/lib/store';
import { useStore as useMoney } from '../modules/money/lib/store';
import { useStore as useShopping } from '../modules/shopping/lib/store';
import { toDateKey } from './dates';
import { cancelScheduled, notificationId } from './notify';
import { itemsForShoppingDay, learnFrequency, shoppingDates, usualShoppingDay } from './predictions';

const PREPARED_KEY = 'predictions:shopping:v1';
const CHORES_KEY = 'predictions:chores:v1';

/** What was put on the list for the coming shopping day. */
export interface Prepared {
  /** The shopping day, YYYY-MM-DD */
  date: string;
  items: string[];
}

const Context = createContext<Prepared | null>(null);
/** The items added automatically for the coming shopping day, if any. */
export const usePrepared = () => useContext(Context);

/**
 * Applies what the app learned from your data, once the stores have loaded:
 * - the day before your usual shopping day, fills the list with what's low or will run out before the next shop;
 * - once a day, nudges chore frequencies you keep skipping or doing early;
 * - a reminder the evening before shopping day.
 */
export function PredictionsRunner({ children }: { children: ReactNode }) {
  const kitchen = useKitchen();
  const shopping = useShopping();
  const chores = useChores();
  const money = useMoney();
  const ready = kitchen.ready && shopping.ready && chores.ready && money.ready;
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [today, setToday] = useState(toDateKey());
  const latest = useRef({ kitchen, shopping, chores, money });
  latest.current = { kitchen, shopping, chores, money };

  // Notice a new day while the app stays open.
  useEffect(() => {
    const id = setInterval(() => setToday(toDateKey()), 60000);
    return () => clearInterval(id);
  }, []);

  const day = ready ? usualShoppingDay(shoppingDates(shopping.state.trips, money.state.expenses), today) : null;
  const weekday = day?.weekday ?? null;

  // Fill the shopping list the day before (or on the day, if the app wasn't opened the day before).
  useEffect(() => {
    if (!ready || !day) return;
    (async () => {
      const saved = JSON.parse((await AsyncStorage.getItem(PREPARED_KEY)) ?? 'null') as Prepared | null;
      if (saved?.date === day.next) {
        setPrepared(saved);
        return;
      }
      const { kitchen: k, shopping: s, chores: c } = latest.current;
      const shoppedToday = s.state.trips.some((t) => t.date === today);
      if (today !== addDays(day.next, -1) && !(today === day.next && !shoppedToday)) return;
      const onList = s.state.items.filter((i) => !i.checked).map((i) => i.name);
      const items = itemsForShoppingDay(k.state.items, c.state.supplies, onList, day.next, today).map((i) => i.name);
      if (items.length) s.addItems(items.map((name) => ({ name })), 'inventory');
      const next = { date: day.next, items };
      await AsyncStorage.setItem(PREPARED_KEY, JSON.stringify(next));
      setPrepared(next);
    })().catch((e) => console.warn('Could not prepare the shopping list', e));
    // Runs once per day and shopping day; the stores are read through `latest`.
  }, [ready, today, day?.next]);

  // A reminder at 18:00 the evening before your usual shopping day.
  useEffect(() => {
    if (Platform.OS === 'web' || weekday === null) return;
    (async () => {
      const { granted } = await Notifications.getPermissionsAsync();
      if (!granted) return;
      await cancelScheduled('predict-');
      await Notifications.scheduleNotificationAsync({
        identifier: notificationId('predict-'),
        content: { title: '🛒 Tomorrow is shopping day', body: 'Open Home Helper and your list fills up with what’s low or about to run out.' },
        // Expo counts 1 = Sunday; the evening before is one weekday earlier.
        trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: ((weekday + 6) % 7) + 1, hour: 18, minute: 0 },
      });
    })().catch((e) => console.warn('Could not schedule the shopping reminder', e));
  }, [weekday]);

  // Chore frequencies that follow your habits, checked once a day.
  useEffect(() => {
    if (!ready) return;
    (async () => {
      if ((await AsyncStorage.getItem(CHORES_KEY)) === today) return;
      const c = latest.current.chores;
      const now = new Date();
      for (const task of c.state.tasks) {
        const change = learnFrequency(task, c.state.completions, now);
        if (change) c.updateTask(task.id, { everyDays: change.everyDays, learned: { from: task.everyDays, on: today } });
      }
      await AsyncStorage.setItem(CHORES_KEY, today);
    })().catch((e) => console.warn('Could not learn chore frequencies', e));
  }, [ready, today]);

  return <Context.Provider value={prepared}>{children}</Context.Provider>;
}
