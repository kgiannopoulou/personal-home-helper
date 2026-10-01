import * as Notifications from 'expo-notifications';
import { cancelScheduled, notificationId } from '../../../shared/notify';
import { Platform } from 'react-native';
import { expiryDigest } from './expiry';
import type { InventoryItem } from './types';

export const remindersSupported = Platform.OS !== 'web';

if (remindersSupported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

let permissionAsked = false;

/**
 * One notification at 09:00 the day before food expires, grouping everything
 * that expires on the same day. Replaces previously scheduled reminders.
 */
export async function syncExpiryReminders(items: InventoryItem[], enabled: boolean): Promise<void> {
  if (!remindersSupported) return;
  await cancelScheduled('kitchen-');
  if (!enabled) return;
  const digest = expiryDigest(items, new Date());
  if (digest.length === 0) return;

  if (!permissionAsked) {
    permissionAsked = true;
    const { granted } = await Notifications.requestPermissionsAsync();
    if (!granted) return;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('expiry', {
        name: 'Food expiry',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
  }

  await Promise.all(
    digest.map((d) =>
      Notifications.scheduleNotificationAsync({
        identifier: notificationId('kitchen-'),
        content: { title: d.title, body: d.body },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: d.at, channelId: 'expiry' },
      }),
    ),
  );
}
