import type { Intensity, WorkoutType } from '../../activity/lib/types';
import type { LaundryType } from '../../chores/lib/types';
import type { Meal } from '../../food/lib/types';
import type { StockUpdate } from '../../kitchen/lib/store';
import type { AdminKind } from '../../planner/lib/types';
import type { ExpenseCategory } from '../../money/lib/types';
import { normalizeName } from '../../../shared/homeCore';

export const SECTIONS = ['kitchen', 'shopping', 'chores', 'calendar_week', 'todos', 'food_week', 'activity_week', 'money', 'forecast'] as const;
export type Section = (typeof SECTIONS)[number];

export const HISTORY_MODULES = ['money', 'food', 'activity', 'chores', 'shopping'] as const;
export type HistoryModule = (typeof HISTORY_MODULES)[number];

/** Everything the assistant can do. Each returns a short sentence saying what happened. */
export interface Actions {
  addToShopping(items: string[]): string;
  markFinished(items: string[]): string;
  markBought(items: string[]): string;
  logWater(ml: number): string;
  logFood(f: { name: string; meal: Meal; kcal: number; protein: number; carbs: number; fat: number; fiber: number }): string;
  logWorkout(w: { type: WorkoutType; minutes: number; intensity: Intensity }): string;
  addTodo(t: { title: string; due?: string; minutes?: number }): string;
  addEvent(e: { title: string; date: string; start?: string; end?: string; location?: string }): string;
  addExpense(e: { amount: number; category: ExpenseCategory; note?: string }): string;
  completeChore(name: string): string;
  addChoreToToday(name: string): string;
  startLaundry(type: LaundryType, minutes?: number): string;
  lookUp(section: Section): string;
  lookUpHistory(module: HistoryModule, days: number): string;
  /** A planned meal, shown in the planner at that meal's usual time */
  planMeal(m: { date: string; meal: Meal; name: string }): string;
  /** New days (1 = Sunday … 7 = Saturday) and optional time for scheduled workouts */
  setTrainingDays(weekdays: number[], time?: string): string;
  /** What a fridge or cupboard photo shows */
  updateKitchenStock(items: StockUpdate[]): string;
  /** A bill or renewal, as a life-admin item with a due date */
  addBill(b: { title: string; kind: AdminKind; due: string; amount?: number; repeatMonths?: number }): string;
}

/** Best match for a name the user said: exact, then contains, case- and plural-insensitive. */
export function findByName<T extends { name: string }>(items: T[], name: string): T | undefined {
  const key = normalizeName(name);
  return (
    items.find((i) => normalizeName(i.name) === key) ??
    items.find((i) => normalizeName(i.name).includes(key)) ??
    items.find((i) => key.includes(normalizeName(i.name)))
  );
}
