// The legacy API is used on purpose: the new `expo-calendar` API isn't available in Expo Go yet.
import * as Calendar from 'expo-calendar/legacy';
import { Platform } from 'react-native';
import type { CalEvent } from './types';

export const calendarSupported = Platform.OS !== 'web';

export interface PhoneCalendar {
  id: string;
  title: string;
  account: string;
  color?: string;
}

export async function requestCalendarAccess(): Promise<boolean> {
  if (!calendarSupported || !(await Calendar.isAvailableAsync())) return false;
  const { granted } = await Calendar.requestCalendarPermissionsAsync();
  return granted;
}

/** The phone's calendars: Google, Outlook/Exchange and iCloud accounts all appear here once added on the phone. */
export async function listCalendars(): Promise<PhoneCalendar[]> {
  if (!(await requestCalendarAccess())) return [];
  const cals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  return cals.map((c) => ({ id: c.id, title: c.title, account: c.source?.name ?? '', color: c.color }));
}

/**
 * Android stores all-day events at UTC midnight, iOS at local midnight (ending at 23:59:59).
 * Both become local midnights, ending at the midnight after the last day, so "Mom's birthday"
 * never slides to the day before.
 */
function allDayToLocal(value: string | Date, isEnd = false): string {
  const d = new Date(value);
  const utc = Platform.OS === 'android';
  const [y, m, day, h, min] = utc
    ? [d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes()]
    : [d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()];
  const notMidnight = h !== 0 || min !== 0;
  return new Date(y, m, day + (isEnd && notMidnight ? 1 : 0)).toISOString();
}

/** Events from the chosen calendars (all when `ids` is null) between two dates. */
export async function loadPhoneEvents(ids: string[] | null, from: Date, to: Date): Promise<CalEvent[]> {
  const calendars = await listCalendars();
  const chosen = calendars.filter((c) => !ids || ids.includes(c.id));
  if (!chosen.length) return [];
  const names = new Map(chosen.map((c) => [c.id, c.title]));
  const events = await Calendar.getEventsAsync(
    chosen.map((c) => c.id),
    from,
    to,
  );
  return events.map((e) => ({
    // Repeating events share an id, so the start time keeps each occurrence unique.
    id: `${e.id}@${new Date(e.startDate).toISOString()}`,
    title: e.title || '(no title)',
    start: e.allDay ? allDayToLocal(e.startDate) : new Date(e.startDate).toISOString(),
    end: e.allDay ? allDayToLocal(e.endDate, true) : new Date(e.endDate).toISOString(),
    allDay: !!e.allDay,
    location: e.location || undefined,
    source: 'device' as const,
    calendarName: names.get(e.calendarId),
  }));
}
