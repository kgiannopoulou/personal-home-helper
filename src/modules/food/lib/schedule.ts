import type { ReminderSettings } from './types';

/** Reminder hours between waking and sleeping, e.g. wake 8, sleep 22, every 2 h → 9, 11 … 21. */
export function waterReminderHours(s: Pick<ReminderSettings, 'wakeHour' | 'sleepHour' | 'waterEveryHours'>): number[] {
  const hours: number[] = [];
  const step = Math.max(1, Math.round(s.waterEveryHours));
  for (let h = s.wakeHour + 1; h < s.sleepHour; h += step) hours.push(h);
  return hours;
}
