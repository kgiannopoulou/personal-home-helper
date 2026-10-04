/**
 * How each kind of record maps between the phone (camelCase, as the modules keep it) and the
 * server (snake_case rows, home-helper-api). Pure functions, tested in __tests__/sync.
 *
 * toRow gives what the server stores, without id and updated_at. Its hash is how the ledger
 * notices a change, so phone-only fields (a kitchen item's price, a learned change you've
 * seen) never cause a sync. fromRow keeps those phone-only fields from the record already here.
 */
import { sleepHours } from '../../modules/activity/lib/fitness';
import type { SleepEntry, WeightEntry, Workout } from '../../modules/activity/lib/types';
import type { Completion, Room, Supply, Task } from '../../modules/chores/lib/types';
import type { FoodEntry, WaterEntry } from '../../modules/food/lib/types';
import type { InventoryItem } from '../../modules/kitchen/lib/types';
import type { Expense, Recurring } from '../../modules/money/lib/types';
import type { AdminItem, CalEvent, Todo } from '../../modules/planner/lib/types';
import type { ListItem, Trip } from '../../modules/shopping/lib/types';
import { toDateKey } from '../dates';
import type { ModuleName, ModuleStates, Row, SyncContext } from './types';

type Fields = Record<string, unknown>;

export interface Collection<M extends ModuleName = ModuleName, R extends { id: string } = { id: string }> {
  /** The server's name */
  name: string;
  module: M;
  /** ctx is there for records made from something without ids (steps per day) */
  get: (s: ModuleStates[M], ctx: SyncContext) => R[];
  set: (s: ModuleStates[M], records: R[]) => ModuleStates[M];
  toRow: (r: R, ctx: SyncContext) => Fields;
  fromRow: (row: Row, existing: R | undefined, ctx: SyncContext) => R;
  /** Fields holding ids of another collection of the same module, renamed with it */
  references?: Partial<Record<keyof R & string, string>>;
  /** The module trims this list oldest first; a record missing because it's older than all the rest was trimmed, not deleted */
  trimmedBy?: (r: R) => string;
}

const define = <M extends ModuleName, R extends { id: string }>(c: Collection<M, R>) => c as unknown as Collection;

// Missing optional values are null on the server and absent here.
const str = (v: unknown) => (v === null || v === undefined ? undefined : String(v));
const num = (v: unknown) => (v === null || v === undefined ? undefined : Number(v));
/** Members are household users once you're signed in; their ids are the users' ids as text. */
const userId = (memberId: string | undefined) => (memberId && /^\d+$/.test(memberId) ? Number(memberId) : null);
const memberId = (v: unknown) => (typeof v === 'number' ? String(v) : undefined);

/** "23:15" on the evening before a 07:00 wake-up, as a local time, in ISO. */
export function sleepToTimes(e: Pick<SleepEntry, 'date' | 'bedtime' | 'wake'>): { bed_at: string; woke_at: string } {
  const woke = new Date(`${e.date}T${e.wake}:00`);
  const bed = new Date(`${e.date}T${e.bedtime}:00`);
  if (bed >= woke) bed.setDate(bed.getDate() - 1);
  return { bed_at: bed.toISOString(), woke_at: woke.toISOString() };
}

/** A day's steps as a record: the phone keeps steps as `{ "2026-10-04": 8123 }`, without ids. */
export interface StepDay {
  id: string;
  date: string;
  steps: number;
}

const CROCKFORD = '0123456789abcdefghjkmnpqrstvwxyz';
const base32 = (n: number, length: number) => {
  let out = '';
  for (let i = 0; i < length; i++) {
    out = CROCKFORD[n % 32] + out;
    n = Math.floor(n / 32);
  }
  return out;
};

/**
 * The id of one person's steps on one day, the same as StepCount::idFor() on the server: a ULID
 * whose time is midnight UTC of the day and whose "random" part is the user id. Every phone of
 * that person makes the same id for the same day, so a day is never stored twice.
 */
export const stepsId = (userId: number, date: string) => base32(Date.parse(`${date}T00:00:00Z`), 10) + base32(userId, 16);

const hhmm = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export const COLLECTIONS: Collection[] = [
  // ── Money ──
  define<'money', Recurring>({
    name: 'recurring_bills',
    module: 'money',
    get: (s) => s.recurring,
    set: (s, recurring) => ({ ...s, recurring }),
    toRow: (r) => ({ name: r.name, amount: r.amount, category: r.category, day_of_month: r.dayOfMonth, active: true }),
    fromRow: (row) => ({ id: row.id, name: String(row.name), amount: Number(row.amount), category: row.category as Recurring['category'], dayOfMonth: Number(row.day_of_month) }),
  }),
  define<'money', Expense>({
    name: 'expenses',
    module: 'money',
    get: (s) => s.expenses,
    set: (s, expenses) => ({ ...s, expenses }),
    toRow: (e) => ({ date: e.date, amount: e.amount, category: e.category, note: e.note ?? null, source: e.source, recurring_bill_id: e.recurringId ?? null }),
    fromRow: (row) => ({
      id: row.id,
      date: String(row.date),
      amount: Number(row.amount),
      category: row.category as Expense['category'],
      note: str(row.note),
      source: row.source as Expense['source'],
      recurringId: str(row.recurring_bill_id),
    }),
    references: { recurringId: 'recurring_bills' },
  }),

  // ── Shopping ──
  define<'shopping', Trip>({
    name: 'shopping_trips',
    module: 'shopping',
    get: (s) => s.trips,
    set: (s, trips) => ({ ...s, trips }),
    toRow: (t) => ({ date: t.date, total: t.total, store: t.store ?? null, item_count: t.itemCount, source: t.source }),
    fromRow: (row) => ({ id: row.id, date: String(row.date), total: Number(row.total), store: str(row.store), itemCount: Number(row.item_count), source: row.source as Trip['source'] }),
  }),
  define<'shopping', ListItem>({
    name: 'shopping_items',
    module: 'shopping',
    get: (s) => s.items,
    set: (s, items) => ({ ...s, items }),
    toRow: (i) => ({ name: i.name, category: i.category, quantity: i.quantity ?? null, price: i.price ?? null, checked: i.checked, source: i.source }),
    fromRow: (row, existing) => ({
      id: row.id,
      name: String(row.name),
      category: row.category as ListItem['category'],
      quantity: str(row.quantity),
      price: num(row.price),
      checked: Boolean(row.checked),
      addedAt: existing?.addedAt ?? row.updated_at,
      source: row.source as ListItem['source'],
    }),
  }),

  // ── Kitchen ──
  define<'kitchen', InventoryItem>({
    name: 'inventory_items',
    module: 'kitchen',
    get: (s) => s.items,
    set: (s, items) => ({ ...s, items }),
    toRow: (i) => ({
      name: i.name,
      category: i.category,
      location: i.location,
      level: i.level,
      quantity: i.quantity ?? null,
      expires_on: i.expiresAt ?? null,
      purchases: i.purchases,
    }),
    fromRow: (row, existing) => {
      const purchases = Array.isArray(row.purchases) ? (row.purchases as string[]) : (existing?.purchases ?? []);
      return {
        ...existing,
        id: row.id,
        name: String(row.name),
        category: row.category as InventoryItem['category'],
        location: row.location as InventoryItem['location'],
        level: row.level as InventoryItem['level'],
        quantity: str(row.quantity),
        expiresAt: str(row.expires_on),
        purchases,
        boughtAt: purchases[purchases.length - 1] ?? existing?.boughtAt ?? String(row.updated_at).slice(0, 10),
      };
    },
  }),

  // ── Chores ──
  define<'chores', Room>({
    name: 'rooms',
    module: 'chores',
    get: (s) => s.rooms,
    set: (s, rooms) => ({ ...s, rooms }),
    toRow: (r) => ({ name: r.name, emoji: r.emoji, personal: Boolean(r.personal) }),
    fromRow: (row) => ({ id: row.id, name: String(row.name), emoji: String(row.emoji), personal: row.personal ? true : undefined }),
  }),
  define<'chores', Task>({
    name: 'chores',
    module: 'chores',
    get: (s) => s.tasks,
    set: (s, tasks) => ({ ...s, tasks }),
    toRow: (t) => ({
      room_id: t.roomId,
      name: t.name,
      every_days: t.everyDays,
      minutes: t.minutes,
      assignee_id: userId(t.assignee),
      learned_from_days: t.learned?.from ?? null,
      learned_on: t.learned?.on ?? null,
      fixed_frequency: Boolean(t.fixedFrequency),
    }),
    fromRow: (row, existing) => {
      const lastDone = [existing?.lastDone, str(row.last_done_at)].filter(Boolean).sort().pop();
      const learnedOn = str(row.learned_on);
      return {
        id: row.id,
        name: String(row.name),
        roomId: String(row.room_id),
        everyDays: Number(row.every_days),
        minutes: Number(row.minutes),
        lastDone: lastDone ? new Date(lastDone).toISOString() : undefined,
        assignee: memberId(row.assignee_id),
        // Whether you've seen a learned change is yours to keep
        learned: learnedOn ? { from: Number(row.learned_from_days), on: learnedOn, seen: existing?.learned?.on === learnedOn ? existing.learned.seen : undefined } : undefined,
        fixedFrequency: row.fixed_frequency ? true : undefined,
      };
    },
    references: { roomId: 'rooms' },
  }),
  define<'chores', Completion>({
    name: 'chore_completions',
    module: 'chores',
    get: (s) => s.completions,
    set: (s, completions) => ({ ...s, completions }),
    toRow: (c) => ({ chore_id: c.taskId, done_at: c.at, minutes: c.minutes, ...(userId(c.by) ? { user_id: userId(c.by) } : {}) }),
    fromRow: (row) => ({ id: row.id, taskId: String(row.chore_id), at: new Date(String(row.done_at)).toISOString(), by: memberId(row.user_id), minutes: Number(row.minutes) }),
    references: { taskId: 'chores' },
    trimmedBy: (c) => c.at,
  }),
  define<'chores', Supply>({
    name: 'supplies',
    module: 'chores',
    get: (s) => s.supplies,
    set: (s, supplies) => ({ ...s, supplies }),
    toRow: (s) => ({ name: s.name, category: s.category, level: s.level }),
    fromRow: (row) => ({ id: row.id, name: String(row.name), category: row.category as Supply['category'], level: row.level as Supply['level'] }),
  }),

  // ── Food (only your own) ──
  define<'food', FoodEntry>({
    name: 'food_entries',
    module: 'food',
    get: (s) => s.foods,
    set: (s, foods) => ({ ...s, foods }),
    toRow: (f) => ({
      date: f.date,
      eaten_at: f.time,
      name: f.name,
      meal: f.meal,
      grams: f.grams === undefined ? null : Math.round(f.grams),
      kcal: Math.round(f.kcal),
      protein: Math.round(f.protein * 10) / 10,
      carbs: Math.round(f.carbs * 10) / 10,
      fat: Math.round(f.fat * 10) / 10,
      fiber: Math.round(f.fiber * 10) / 10,
      source: f.source,
    }),
    fromRow: (row) => ({
      id: row.id,
      date: String(row.date),
      time: new Date(String(row.eaten_at)).toISOString(),
      name: String(row.name),
      grams: num(row.grams),
      meal: row.meal as FoodEntry['meal'],
      source: row.source as FoodEntry['source'],
      kcal: Number(row.kcal),
      protein: Number(row.protein),
      carbs: Number(row.carbs),
      fat: Number(row.fat),
      fiber: Number(row.fiber),
    }),
  }),
  define<'food', WaterEntry>({
    name: 'water_entries',
    module: 'food',
    get: (s) => s.water,
    set: (s, water) => ({ ...s, water }),
    toRow: (w) => ({ date: w.date, drunk_at: w.time, ml: Math.round(w.ml), drink: w.drink }),
    fromRow: (row) => ({ id: row.id, date: String(row.date), time: new Date(String(row.drunk_at)).toISOString(), ml: Number(row.ml), drink: row.drink as WaterEntry['drink'] }),
  }),

  // ── Activity (only your own) ──
  define<'activity', Workout>({
    name: 'workouts',
    module: 'activity',
    get: (s) => s.workouts,
    set: (s, workouts) => ({ ...s, workouts }),
    toRow: (w) => ({ date: w.date, type: w.type, minutes: w.minutes, intensity: w.intensity, kcal: Math.round(w.kcal), source: w.source, notes: w.notes ?? null }),
    fromRow: (row) => ({
      id: row.id,
      date: String(row.date),
      type: row.type as Workout['type'],
      minutes: Number(row.minutes),
      intensity: row.intensity as Workout['intensity'],
      kcal: Number(row.kcal),
      source: row.source as Workout['source'],
      notes: str(row.notes),
    }),
  }),
  define<'activity', SleepEntry>({
    name: 'sleep_entries',
    module: 'activity',
    get: (s) => s.sleep,
    set: (s, sleep) => ({ ...s, sleep }),
    toRow: (e) => ({ date: e.date, ...sleepToTimes(e), quality: e.quality }),
    fromRow: (row) => {
      const bedtime = hhmm(String(row.bed_at));
      const wake = hhmm(String(row.woke_at));
      return { id: row.id, date: String(row.date), bedtime, wake, hours: sleepHours(bedtime, wake), quality: Number(row.quality) };
    },
  }),
  define<'activity', StepDay>({
    name: 'step_counts',
    module: 'activity',
    // Only finished days: today's count changes with every few steps and would sync all day long
    get: (s, ctx) =>
      Object.entries(s.steps)
        .filter(([date, steps]) => date < toDateKey() && steps > 0)
        .map(([date, steps]) => ({ id: stepsId(ctx.userId, date), date, steps: Math.round(steps) })),
    set: (s, days) => {
      const today = Object.entries(s.steps).filter(([date]) => date >= toDateKey());
      return { ...s, steps: Object.fromEntries([...days.map((d) => [d.date, d.steps] as const), ...today]) };
    },
    toRow: (d) => ({ date: d.date, steps: d.steps }),
    fromRow: (row) => ({ id: row.id, date: String(row.date), steps: Number(row.steps) }),
  }),
  define<'activity', WeightEntry>({
    name: 'weights',
    module: 'activity',
    get: (s) => s.weights,
    set: (s, weights) => ({ ...s, weights }),
    toRow: (w) => ({ date: w.date, kg: w.kg }),
    fromRow: (row) => ({ id: row.id, date: String(row.date), kg: Number(row.kg) }),
  }),

  // ── Planner ──
  define<'planner', CalEvent>({
    name: 'events',
    module: 'planner',
    get: (s) => s.manualEvents,
    set: (s, manualEvents) => ({ ...s, manualEvents }),
    toRow: (e) => ({ title: e.title, starts_at: e.start, ends_at: e.end, all_day: e.allDay, location: e.location ?? null }),
    fromRow: (row) => ({
      id: row.id,
      title: String(row.title),
      start: new Date(String(row.starts_at)).toISOString(),
      end: new Date(String(row.ends_at)).toISOString(),
      allDay: Boolean(row.all_day),
      location: str(row.location),
      source: 'manual',
    }),
  }),
  define<'planner', Todo>({
    name: 'todos',
    module: 'planner',
    get: (s) => s.todos,
    set: (s, todos) => ({ ...s, todos }),
    toRow: (t) => ({ title: t.title, due_on: t.due ?? null, minutes: t.minutes ?? null, done_at: t.done ?? null }),
    fromRow: (row, existing) => ({
      id: row.id,
      title: String(row.title),
      due: str(row.due_on),
      minutes: num(row.minutes),
      done: row.done_at ? new Date(String(row.done_at)).toISOString() : undefined,
      createdAt: existing?.createdAt ?? String(row.updated_at),
    }),
  }),
  define<'planner', AdminItem>({
    name: 'admin_items',
    module: 'planner',
    get: (s) => s.admin,
    set: (s, admin) => ({ ...s, admin }),
    toRow: (a) => ({
      title: a.title,
      kind: a.kind,
      due_on: a.due,
      repeat_months: a.repeatMonths,
      remind_days: a.remindDays,
      amount: a.amount ?? null,
      done_at: a.done ? (a.history[a.history.length - 1] ?? null) : null,
    }),
    fromRow: (row, existing) => {
      const doneAt = row.done_at ? new Date(String(row.done_at)).toISOString() : undefined;
      const history = existing?.history ?? [];
      return {
        id: row.id,
        title: String(row.title),
        kind: row.kind as AdminItem['kind'],
        due: String(row.due_on),
        repeatMonths: Number(row.repeat_months),
        remindDays: Number(row.remind_days),
        amount: num(row.amount),
        done: doneAt ? true : undefined,
        history: doneAt && !history.includes(doneAt) ? [...history, doneAt] : history,
      };
    },
  }),
];

export const COLLECTION_BY_NAME: Record<string, Collection> = Object.fromEntries(COLLECTIONS.map((c) => [c.name, c]));

