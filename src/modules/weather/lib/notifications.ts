import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { IndoorAdvice } from './indoor';
import { outfitAdvice } from './outfit';
import type { Forecast } from './types';
import { weatherLabel } from './weather';

export const notificationsSupported = Platform.OS !== 'web';

if (notificationsSupported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

let permission: boolean | null = null;

async function ensurePermission(): Promise<boolean> {
  if (permission !== null) return permission;
  const { granted } = await Notifications.requestPermissionsAsync();
  permission = granted;
  if (granted && Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('weather', { name: 'Morning weather', importance: Notifications.AndroidImportance.DEFAULT });
    await Notifications.setNotificationChannelAsync('indoor', { name: 'Indoor air', importance: Notifications.AndroidImportance.HIGH });
  }
  return granted;
}

/** Text for one morning: "🌧️ Cool and rainy · 8° → 14°" + the first two tips. */
export function morningText(forecast: Forecast, date: string): { title: string; body: string } | null {
  const outfit = outfitAdvice(forecast, date);
  const day = forecast.days.find((d) => d.date === date);
  if (!outfit || !day) return null;
  return {
    title: `${weatherLabel(day.code).emoji} ${outfit.headline} · ${outfit.summary.split(' · ')[0]}`,
    body: outfit.items
      .slice(0, 2)
      .map((i) => `${i.emoji} ${i.text}`)
      .join('\n'),
  };
}

const MORNING_PREFIX = 'morning-';

/** Schedules the "what to wear" notification for each morning in the forecast (refreshed whenever the app opens). */
export async function syncMorningWeather(forecast: Forecast | null, enabled: boolean, hour: number, minute: number): Promise<void> {
  if (!notificationsSupported) return;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled.filter((n) => n.identifier.startsWith(MORNING_PREFIX)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
  if (!enabled || !forecast || !(await ensurePermission())) return;
  const now = new Date();
  await Promise.all(
    forecast.days.slice(0, 5).map((d) => {
      const [y, m, day] = d.date.split('-').map(Number);
      const at = new Date(y, m - 1, day, hour, minute);
      const text = morningText(forecast, d.date);
      if (at <= now || !text) return null;
      return Notifications.scheduleNotificationAsync({
        identifier: `${MORNING_PREFIX}${d.date}`,
        content: text,
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: 'weather' },
      });
    }),
  );
}

export async function sendIndoorAlert(advice: IndoorAdvice): Promise<void> {
  if (!notificationsSupported || !(await ensurePermission())) return;
  await Notifications.scheduleNotificationAsync({
    content: { title: `${advice.emoji} ${advice.title}`, body: advice.text },
    trigger: null,
  });
}
