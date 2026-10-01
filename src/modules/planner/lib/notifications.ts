import * as Notifications from 'expo-notifications';
import { cancelScheduled, notificationId } from '../../../shared/notify';
import { Platform } from 'react-native';
import { toDateKey } from '../../../shared/dates';
import { addDays, briefingText, morningBriefing, type BriefingInput } from './planner';

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
    await Notifications.setNotificationChannelAsync('briefing', {
      name: 'Morning briefing',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  return granted;
}

/**
 * Schedules the morning briefing for the next 7 days with each day's real contents.
 * Called whenever the app opens or data changes, so the text stays up to date.
 */
export async function syncBriefings(input: BriefingInput, enabled: boolean, hour: number, minute: number): Promise<void> {
  if (!notificationsSupported) return;
  await cancelScheduled('planner-');
  if (!enabled || !(await ensurePermission())) return;
  const now = new Date();
  const today = toDateKey(now);
  const jobs: Promise<string>[] = [];
  for (let i = 0; i < 7; i++) {
    const key = addDays(today, i);
    const [y, m, d] = key.split('-').map(Number);
    const at = new Date(y, m - 1, d, hour, minute);
    if (at <= now) continue;
    const { title, body } = briefingText(morningBriefing(input, key));
    jobs.push(
      Notifications.scheduleNotificationAsync({
        identifier: notificationId('planner-'),
        content: { title, body },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: 'briefing' },
      }),
    );
  }
  await Promise.all(jobs);
}
