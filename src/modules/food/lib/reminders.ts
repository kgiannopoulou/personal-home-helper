import * as Notifications from 'expo-notifications';
import { cancelScheduled, notificationId } from '../../../shared/notify';
import { Platform } from 'react-native';
import { waterReminderHours } from './schedule';
import type { ReminderSettings } from './types';

export { waterReminderHours };

export const remindersSupported = Platform.OS !== 'web';

if (remindersSupported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

const MEAL_TEXT = {
  breakfast: 'Breakfast time 🍳 Log what you eat so your day adds up.',
  lunch: 'Lunch time 🥗 Not sure what to eat? Open the app for a suggestion.',
  dinner: 'Dinner time 🍲 Check what nutrients you still need today.',
} as const;

/** Replaces every scheduled reminder with the current settings. Returns how many were scheduled. */
export async function applyReminders(s: ReminderSettings): Promise<number> {
  if (!remindersSupported) return 0;
  await cancelScheduled('food-');
  if (!s.enabled) return 0;

  const { granted } = await Notifications.requestPermissionsAsync();
  if (!granted) throw new Error('Notification permission was not granted.');

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Water & meal reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const daily = (hour: number, minute: number, title: string, body: string) =>
    Notifications.scheduleNotificationAsync({
      identifier: notificationId('food-'),
      content: { title, body },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute, channelId: 'reminders' },
    });

  const jobs: Promise<string>[] = waterReminderHours(s).map((h) =>
    daily(h, 0, 'Time to drink water 💧', 'Have a glass of water and tap +250 ml to log it.'),
  );
  for (const [meal, hhmm] of Object.entries(s.meals) as [keyof typeof MEAL_TEXT, string][]) {
    const [h, m] = hhmm.split(':').map(Number);
    if (Number.isFinite(h) && Number.isFinite(m)) jobs.push(daily(h, m, 'Meal reminder', MEAL_TEXT[meal]));
  }
  await Promise.all(jobs);
  return jobs.length;
}
