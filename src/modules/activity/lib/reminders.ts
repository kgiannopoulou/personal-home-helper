import * as Notifications from 'expo-notifications';
import { cancelScheduled, notificationId } from '../../../shared/notify';
import { Platform } from 'react-native';
import { isTime, minusMinutes, WORKOUT_LABEL } from './fitness';
import type { TrainingSchedule } from './types';

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

/**
 * For every training day: a fuel reminder 90 min before and a hydration/warm-up
 * reminder 15 min before. Replaces all previously scheduled reminders.
 */
export async function applyTrainingReminders(s: TrainingSchedule): Promise<number> {
  if (!remindersSupported) return 0;
  await cancelScheduled('activity-');
  if (!s.enabled || !isTime(s.time)) return 0;

  const { granted } = await Notifications.requestPermissionsAsync();
  if (!granted) throw new Error('Notification permission was not granted.');
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('training', {
      name: 'Training reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const label = WORKOUT_LABEL[s.type];
  const jobs: Promise<string>[] = [];
  for (const day of s.weekdays) {
    const fuel = minusMinutes(day, s.time, 90);
    jobs.push(
      Notifications.scheduleNotificationAsync({
        identifier: notificationId('activity-'),
        content: { title: `${label} in 90 minutes`, body: 'Time for a light carb snack (a banana or toast) so you have energy.' },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, channelId: 'training', ...fuel },
      }),
    );
    const sip = minusMinutes(day, s.time, 15);
    jobs.push(
      Notifications.scheduleNotificationAsync({
        identifier: notificationId('activity-'),
        content: { title: `${label} in 15 minutes`, body: 'Sip some water (no big gulps) and start warming up.' },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, channelId: 'training', ...sip },
      }),
    );
  }
  await Promise.all(jobs);
  return jobs.length;
}
