import type { Category } from '../../../shared/homeCore';

export interface Room {
  id: string;
  name: string;
  emoji: string;
  /** Personal routines (skincare, plants…) rather than cleaning; left out of cleaning mode */
  personal?: boolean;
}

export interface Task {
  id: string;
  name: string;
  roomId: string;
  /** Repeat every N days (1 = daily, 7 = weekly, 30 = monthly) */
  everyDays: number;
  /** How long it takes you, in minutes */
  minutes: number;
  /** ISO timestamp */
  lastDone?: string;
  /** Household member responsible */
  assignee?: string;
  /** Set when the app changed everyDays from your habits; `seen` once you've kept it */
  learned?: { from: number; on: string; seen?: boolean };
  /** You undid a learned change, so the frequency stays as you set it */
  fixedFrequency?: boolean;
}

export interface Completion {
  id: string;
  taskId: string;
  /** ISO timestamp */
  at: string;
  by?: string;
  minutes: number;
}

export type SupplyLevel = 'full' | 'half' | 'low' | 'out';

export interface Supply {
  id: string;
  name: string;
  category: Category;
  level: SupplyLevel;
}

export interface Member {
  id: string;
  name: string;
}

export type LaundryType = 'whites' | 'colours' | 'darks' | 'mixed';

export interface LaundryLoad {
  type: LaundryType;
  /** ISO timestamp */
  startedAt: string;
  minutes: number;
  notificationId?: string;
}

export interface Settings {
  /** Minutes you have for chores on each weekday, Sunday = 0. A busy Monday might be 15. */
  dailyMinutes: number[];
  laundryMinutes: number;
}

export interface AppState {
  rooms: Room[];
  tasks: Task[];
  completions: Completion[];
  supplies: Supply[];
  members: Member[];
  /** The member using this phone; completions are credited to them */
  meId?: string;
  laundry: LaundryLoad | null;
  /** Tasks you added to today's plan by hand */
  pinned: { date: string; taskIds: string[] };
  settings: Settings;
}
