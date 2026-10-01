import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { LaundryType } from './types';

export const notificationsSupported = Platform.OS !== 'web';

if (notificationsSupported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
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
    await Notifications.setNotificationChannelAsync('laundry', {
      name: 'Laundry',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  return granted;
}

/** "Your whites may be ready" when the load should be done. Returns the notification id. */
export async function scheduleLaundry(type: LaundryType, at: Date): Promise<string | undefined> {
  if (!notificationsSupported || !(await ensurePermission())) return undefined;
  return Notifications.scheduleNotificationAsync({
    content: { title: '🧺 Laundry may be ready', body: `Your ${type} load should be done. Hang it up before it creases!` },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: 'laundry' },
  });
}

export async function cancelNotification(id?: string): Promise<void> {
  if (!notificationsSupported || !id) return;
  await Notifications.cancelScheduledNotificationAsync(id);
}
