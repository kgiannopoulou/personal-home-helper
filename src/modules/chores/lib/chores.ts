import { toDateKey } from '../../../shared/dates';
import { normalizeName } from '../../../shared/homeCore';
import type { Completion, LaundryLoad, Member, Room, Supply, SupplyLevel, Task } from './types';

const DAY = 24 * 60 * 60 * 1000;

export const FREQUENCIES: { days: number; label: string }[] = [
  { days: 1, label: 'Daily' },
  { days: 2, label: 'Every 2 days' },
  { days: 3, label: 'Every 3 days' },
  { days: 7, label: 'Weekly' },
  { days: 14, label: 'Every 2 weeks' },
  { days: 30, label: 'Monthly' },
  { days: 90, label: 'Every 3 months' },
  { days: 180, label: 'Every 6 months' },
];

export function frequencyLabel(days: number): string {
  return FREQUENCIES.find((f) => f.days === days)?.label ?? `Every ${days} days`;
}

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export type DueStatus = 'overdue' | 'due' | 'soon' | 'ok';

export interface DueInfo {
  /** How far through its cycle the task is: 1 = due today, 2 = a whole cycle late */
  urgency: number;
  /** Days until due (negative = overdue) */
  dueIn: number;
  status: DueStatus;
}

/** Midnight-based day difference, so "done yesterday at 23:00" counts as one day ago. */
function daysBetween(fromIso: string, now: Date): number {
  const from = new Date(fromIso);
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((b - a) / DAY);
}

export function dueInfo(task: Task, now: Date = new Date()): DueInfo {
  if (!task.lastDone) return { urgency: 1, dueIn: 0, status: 'due' };
  const since = daysBetween(task.lastDone, now);
  const dueIn = task.everyDays - since;
  const urgency = since / task.everyDays;
  const status: DueStatus = dueIn < 0 ? 'overdue' : dueIn === 0 ? 'due' : dueIn <= Math.max(1, task.everyDays * 0.2) ? 'soon' : 'ok';
  return { urgency, dueIn, status };
}

export function dueText(task: Task, now: Date = new Date()): string {
  if (!task.lastDone) return 'Not done yet';
  const { dueIn } = dueInfo(task, now);
  if (dueIn < 0) return `${-dueIn} day${dueIn === -1 ? '' : 's'} overdue`;
  if (dueIn === 0) return 'Due today';
  if (dueIn === 1) return 'Due tomorrow';
  return `Due in ${dueIn} days`;
}

export function doneToday(task: Task, now: Date = new Date()): boolean {
  return !!task.lastDone && daysBetween(task.lastDone, now) === 0;
}

/** Most urgent first; ties broken by the shorter task. */
const byUrgency = (now: Date) => (a: Task, b: Task) => dueInfo(b, now).urgency - dueInfo(a, now).urgency || a.minutes - b.minutes;

export function dueTasks(tasks: Task[], now: Date = new Date()): Task[] {
  return tasks.filter((t) => dueInfo(t, now).urgency >= 1 && !doneToday(t, now)).sort(byUrgency(now));
}

export interface Plan {
  tasks: Task[];
  minutes: number;
}

/**
 * "I have 10 minutes": picks the most urgent tasks that fit in the time.
 * Tasks that aren't quite due yet (from 60% of their cycle) are allowed as fillers.
 */
export function planForTime(tasks: Task[], minutes: number, now: Date = new Date(), exclude: string[] = []): Plan {
  const candidates = tasks
    .filter((t) => !exclude.includes(t.id) && !doneToday(t, now) && dueInfo(t, now).urgency >= 0.6 && t.minutes > 0)
    .sort(byUrgency(now));
  const picked: Task[] = [];
  let used = 0;
  for (const t of candidates) {
    if (used + t.minutes > minutes) continue;
    picked.push(t);
    used += t.minutes;
  }
  return { tasks: picked, minutes: used };
}

export interface TodayPlan extends Plan {
  /** Minutes available today from your weekly settings */
  capacity: number;
  /** Due tasks that didn't fit today */
  postponed: number;
}

/** Today's chores: anything you pinned, then due tasks that fit in today's free time. */
export function todayPlan(tasks: Task[], pinnedIds: string[], capacity: number, now: Date = new Date()): TodayPlan {
  const pinned = pinnedIds.map((id) => tasks.find((t) => t.id === id)).filter((t): t is Task => !!t);
  const pinnedOpen = pinned.filter((t) => !doneToday(t, now));
  const usedByPinned = pinnedOpen.reduce((m, t) => m + t.minutes, 0);
  const due = dueTasks(tasks, now).filter((t) => !pinnedIds.includes(t.id));
  const fill: Task[] = [];
  let used = usedByPinned;
  for (const t of due) {
    if (used + t.minutes > capacity) continue;
    fill.push(t);
    used += t.minutes;
  }
  return { tasks: [...pinnedOpen, ...fill], minutes: used, capacity, postponed: due.length - fill.length };
}

export interface CleaningGroup {
  room: Room;
  tasks: Task[];
  minutes: number;
}

/**
 * Cleaning mode: fills the time with the dirtiest rooms' tasks (from half-way through their cycle),
 * then lists them room by room so you don't walk back and forth.
 */
export function cleaningPlan(tasks: Task[], rooms: Room[], minutes: number, now: Date = new Date()): CleaningGroup[] {
  const cleaningRooms = rooms.filter((r) => !r.personal);
  const ids = new Set(cleaningRooms.map((r) => r.id));
  const candidates = tasks
    .filter((t) => ids.has(t.roomId) && !doneToday(t, now) && dueInfo(t, now).urgency >= 0.5 && t.minutes > 0)
    .sort(byUrgency(now));
  const picked: Task[] = [];
  let used = 0;
  for (const t of candidates) {
    if (used + t.minutes > minutes) continue;
    picked.push(t);
    used += t.minutes;
  }
  return cleaningRooms
    .map((room) => {
      const roomTasks = picked.filter((t) => t.roomId === room.id);
      return { room, tasks: roomTasks, minutes: roomTasks.reduce((m, t) => m + t.minutes, 0) };
    })
    .filter((g) => g.tasks.length > 0);
}

/**
 * The weekday you usually do a task on, learned from history:
 * at least 3 completions and 60% of them on the same day.
 */
export function usualWeekday(taskId: string, completions: Completion[]): number | null {
  const days = completions.filter((c) => c.taskId === taskId).map((c) => new Date(c.at).getDay());
  if (days.length < 3) return null;
  const counts = new Array(7).fill(0) as number[];
  for (const d of days) counts[d]++;
  const best = counts.indexOf(Math.max(...counts));
  return counts[best] / days.length >= 0.6 ? best : null;
}

/** "You normally clean the bathroom on Saturdays. It's Saturday — add it to today's plan?" */
export function routineSuggestions(tasks: Task[], completions: Completion[], planIds: string[], now: Date = new Date()): Task[] {
  return tasks.filter(
    (t) =>
      t.everyDays >= 7 &&
      !planIds.includes(t.id) &&
      !doneToday(t, now) &&
      dueInfo(t, now).urgency >= 0.6 &&
      usualWeekday(t.id, completions) === now.getDay(),
  );
}

/** Monday 00:00 of the current week. */
export function weekStart(now: Date = new Date()): Date {
  const day = (now.getDay() + 6) % 7;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
}

/** Minutes of chores each member did this week (Mon–Sun). */
export function weekWorkload(completions: Completion[], members: Member[], now: Date = new Date()): { member: Member; minutes: number }[] {
  const start = weekStart(now).getTime();
  return members.map((member) => ({
    member,
    minutes: completions.filter((c) => c.by === member.id && new Date(c.at).getTime() >= start).reduce((m, c) => m + c.minutes, 0),
  }));
}

/** Average minutes per week a task takes (a 10-minute daily task = 70). */
export function weeklyMinutes(task: Task): number {
  return (task.minutes * 7) / task.everyDays;
}

/**
 * Shares tasks so everyone has about the same minutes per week, not the same number of chores.
 * Biggest jobs are handed out first, each to whoever has the least so far.
 */
export function fairAssign(tasks: Task[], members: Member[]): Record<string, string> {
  if (!members.length) return {};
  const load = new Map(members.map((m) => [m.id, 0]));
  const out: Record<string, string> = {};
  const sorted = [...tasks].sort((a, b) => weeklyMinutes(b) - weeklyMinutes(a) || a.name.localeCompare(b.name));
  for (const t of sorted) {
    let best = members[0].id;
    for (const m of members) if (load.get(m.id)! < load.get(best)!) best = m.id;
    out[t.id] = best;
    load.set(best, load.get(best)! + weeklyMinutes(t));
  }
  return out;
}

export function plannedWeeklyLoad(tasks: Task[], members: Member[]): { member: Member; minutes: number }[] {
  return members.map((member) => ({
    member,
    minutes: Math.round(tasks.filter((t) => t.assignee === member.id).reduce((m, t) => m + weeklyMinutes(t), 0)),
  }));
}

// ---------- Supplies ----------

export const LEVELS: SupplyLevel[] = ['full', 'half', 'low', 'out'];
export const LEVEL_LABEL: Record<SupplyLevel, string> = { full: '🟢 Full', half: '🟡 Half', low: '🟠 Low', out: '🔴 Out' };

export const needsBuying = (s: Supply) => s.level === 'low' || s.level === 'out';

/**
 * Understands "I finished the dish soap", "we're out of sponges", "detergent is running low",
 * "bought trash bags". Returns null if it isn't about a supply level.
 */
export function parseSupplyUpdate(text: string): { name: string; level: SupplyLevel } | null {
  const t = text.trim().toLowerCase().replace(/[.!]+$/, '');
  const rules: [RegExp, SupplyLevel][] = [
    [/^(?:i |we )?(?:just )?(?:finished|used up|ran out of|run out of)(?: the| all the| our| my)? (.+)$/, 'out'],
    [/^(?:i'm |im |we're |were |we are |i am )?out of(?: the)? (.+)$/, 'out'],
    [/^(?:the |our |my )?(.+?) (?:is|are) (?:finished|empty|gone|out)$/, 'out'],
    [/^(?:the |our |my )?(.+?) (?:is|are) (?:running |getting |almost )?(?:low|almost empty|nearly empty|running out)$/, 'low'],
    [/^(?:running |almost )?low on(?: the)? (.+)$/, 'low'],
    [/^(?:i |we )?(?:just )?(?:bought|got|restocked|refilled)(?: new| more| the| some)? (.+)$/, 'full'],
  ];
  for (const [re, level] of rules) {
    const m = t.match(re);
    if (m && m[1].trim()) {
      const name = m[1].trim();
      return { name: name[0].toUpperCase() + name.slice(1), level };
    }
  }
  return null;
}

export function findSupply(supplies: Supply[], name: string): Supply | undefined {
  const key = normalizeName(name);
  return supplies.find((s) => normalizeName(s.name) === key) ?? supplies.find((s) => normalizeName(s.name).includes(key) || key.includes(normalizeName(s.name)));
}

// ---------- Laundry ----------

export function laundryStatus(load: LaundryLoad, now: Date = new Date()): { ready: boolean; minutesLeft: number; readyAt: Date } {
  const readyAt = new Date(new Date(load.startedAt).getTime() + load.minutes * 60000);
  const minutesLeft = Math.max(0, Math.ceil((readyAt.getTime() - now.getTime()) / 60000));
  return { ready: minutesLeft === 0, minutesLeft, readyAt };
}

export function formatMinutes(m: number): string {
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} h ${rest} min` : `${h} h`;
}

export const todayKey = (now: Date = new Date()) => toDateKey(now);
