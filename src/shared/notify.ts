import * as Notifications from 'expo-notifications';

/**
 * In the all-in-one app every module schedules notifications, so a module must only
 * replace its own: each one tags its notification ids with a prefix ("food-", "planner-"…).
 */
export async function cancelScheduled(prefix: string): Promise<void> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(all.filter((n) => n.identifier.startsWith(prefix)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
}

let counter = 0;
/** A unique notification id within a module's prefix. */
export const notificationId = (prefix: string) => `${prefix}${Date.now().toString(36)}-${counter++}`;
