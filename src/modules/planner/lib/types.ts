export interface CalEvent {
  id: string;
  title: string;
  /** ISO timestamps */
  start: string;
  end: string;
  allDay: boolean;
  location?: string;
  /** From the phone's calendars (Google, Outlook, iCloud…) or added in this app */
  source: 'device' | 'manual';
  calendarName?: string;
}

export interface Todo {
  id: string;
  title: string;
  /** YYYY-MM-DD */
  due?: string;
  /** Rough time it takes, used to fit it into free gaps */
  minutes?: number;
  /** ISO timestamp when ticked off */
  done?: string;
  createdAt: string;
}

export type AdminKind = 'bill' | 'appointment' | 'renewal' | 'other';

/** Life admin: bills, dentist, insurance renewals, car service… */
export interface AdminItem {
  id: string;
  title: string;
  kind: AdminKind;
  /** YYYY-MM-DD */
  due: string;
  /** Repeats every N months, 0 = one-off */
  repeatMonths: number;
  /** Start reminding this many days before */
  remindDays: number;
  amount?: number;
  /** One-offs are kept as done instead of moving to a next date */
  done?: boolean;
  /** ISO timestamps of completions, newest last */
  history: string[];
}

export interface Person {
  id: string;
  name: string;
  /** MM-DD */
  birthday: string;
  year?: number;
  /** "She likes cooking and gardening" */
  interests: string;
  budget?: number;
  ideas: string[];
  remindDays: number;
}

export interface Settings {
  briefingEnabled: boolean;
  briefingHour: number;
  briefingMinute: number;
  /** Phone calendars to include; null = all */
  calendarIds: string[] | null;
  /** Your waking hours, used for free time */
  dayStart: number;
  dayEnd: number;
  currency: string;
}

export interface AppState {
  manualEvents: CalEvent[];
  todos: Todo[];
  admin: AdminItem[];
  people: Person[];
  /** Ticked trip-checklist items per trip key */
  tripChecks: Record<string, string[]>;
  settings: Settings;
}
