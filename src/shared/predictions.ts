/**
 * Predictions learned from your own data. Pure functions, so they're easy to test;
 * PredictionsRunner applies them in the app.
 */
import { FREQUENCIES } from '../modules/chores/lib/chores';
import type { Completion, Supply, Task } from '../modules/chores/lib/types';
import { addDays, daysBetween, predictRunOut } from '../modules/kitchen/lib/inventory';
import type { InventoryItem } from '../modules/kitchen/lib/types';
import { daysInMonth, monthSummary } from '../modules/money/lib/budget';
import type { Expense, Settings as MoneySettings } from '../modules/money/lib/types';
import { fromDateKey, toDateKey } from './dates';
import { normalizeName } from './homeCore';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ── Shopping day ─────────────────────────────────────────────────────────

export interface ShoppingDay {
  /** 0 = Sunday … 6 = Saturday */
  weekday: number;
  name: string;
  /** Next shopping day, today included */
  next: string;
  /** Share of recent shops on that day, 0–1 */
  share: number;
}

/** Days you shopped: logged trips, plus grocery spends of €15 or more (a real shop, not a snack). */
export function shoppingDates(trips: { date: string }[], expenses: Expense[]): string[] {
  const dates = [...trips.map((t) => t.date), ...expenses.filter((e) => e.category === 'groceries' && e.amount >= 15).map((e) => e.date)];
  return [...new Set(dates)].sort();
}

/**
 * The weekday you usually shop, learned from the last 12 weeks. Needs at least 3 shops,
 * with at least 2 and 40% of them on the same weekday.
 */
export function usualShoppingDay(dates: string[], today: string = toDateKey()): ShoppingDay | null {
  const since = addDays(today, -84);
  const recent = [...new Set(dates)].filter((d) => d >= since && d <= today);
  if (recent.length < 3) return null;
  const counts = Array(7).fill(0) as number[];
  for (const d of recent) counts[fromDateKey(d).getDay()]++;
  const best = counts.indexOf(Math.max(...counts));
  const share = counts[best] / recent.length;
  if (counts[best] < 2 || share < 0.4) return null;
  const ahead = (best - fromDateKey(today).getDay() + 7) % 7;
  return { weekday: best, name: WEEKDAYS[best], next: addDays(today, ahead), share };
}

export interface ToBuy {
  name: string;
  why: string;
}

/**
 * What to put on the list before a shopping day: everything empty or low, and whatever will run
 * out before the shop after it (from how fast you've used it up before). Skips what's already listed.
 */
export function itemsForShoppingDay(
  kitchen: InventoryItem[],
  supplies: Supply[],
  onList: string[],
  shoppingDay: string,
  today: string = toDateKey(),
): ToBuy[] {
  const nextShop = addDays(shoppingDay, 7);
  const listed = new Set(onList.map(normalizeName));
  const out: ToBuy[] = [];
  const add = (name: string, why: string) => {
    const key = normalizeName(name);
    if (listed.has(key)) return;
    listed.add(key);
    out.push({ name, why });
  };
  for (const item of kitchen) {
    if (item.level === 'empty' || item.level === 'low') {
      add(item.name, item.level);
      continue;
    }
    const p = predictRunOut(item, today);
    if (p && p.runsOutOn < nextShop) add(item.name, `runs out around ${p.runsOutOn}`);
  }
  for (const s of supplies) if (s.level === 'low' || s.level === 'out') add(s.name, s.level === 'out' ? 'empty' : 'low');
  return out;
}

// ── Budget forecast ──────────────────────────────────────────────────────

export interface BudgetForecast {
  /** Expected total at the end of the month */
  forecast: number;
  budget: number;
  /** forecast - budget (positive = over); null without a budget */
  over: number | null;
  /** "At this pace: €1,180 of €1,000" */
  text: string;
}

/** €1,180 */
export const wholeMoney = (n: number, currency: string) => `${currency}${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;

/**
 * Where this month will end. Early in the month the pace is shaky, so it leans on how your past
 * months went from this point (if there are any); the further into the month, the more it trusts the pace.
 */
export function budgetForecast(expenses: Expense[], settings: MoneySettings, today: Date = new Date()): BudgetForecast | null {
  const s = monthSummary(expenses, settings, today);
  if (s.total <= 0) return null;
  const progress = today.getDate() / daysInMonth(s.month);
  let forecast = s.projected;
  if (s.usualByNow && s.averageMonth && s.usualByNow > 0) {
    const fromHistory = s.total * (s.averageMonth / s.usualByNow);
    forecast = progress * s.projected + (1 - progress) * fromHistory;
  } else if (today.getDate() < 5) return null; // a few days of pace alone says little
  forecast = Math.max(forecast, s.total);
  const c = settings.currency;
  const budget = settings.monthlyBudget;
  return {
    forecast: Math.round(forecast * 100) / 100,
    budget,
    over: budget > 0 ? Math.round((forecast - budget) * 100) / 100 : null,
    text: budget > 0 ? `At this pace: ${wholeMoney(forecast, c)} of ${wholeMoney(budget, c)}` : `At this pace: about ${wholeMoney(forecast, c)} this month`,
  };
}

// ── Chore frequencies ────────────────────────────────────────────────────

export interface FrequencyChange {
  everyDays: number;
  /** late = you keep doing it later than planned, early = sooner */
  why: 'late' | 'early';
  /** Typical days between doing it */
  typical: number;
}

const dayOf = (iso: string) => toDateKey(new Date(iso));
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

/**
 * A better frequency when the last 3 gaps all ran 30% late (skipping) or 30% early. Moves one step
 * along the usual frequencies at a time, and not again until 3 cycles after the last change.
 * A long overdue stretch right now counts as a late gap.
 */
export function learnFrequency(task: Task, completions: Completion[], now: Date = new Date()): FrequencyChange | null {
  if (task.fixedFrequency) return null;
  const today = toDateKey(now);
  if (task.learned && daysBetween(task.learned.on, today) < task.everyDays * 3) return null;

  const days = [...new Set(completions.filter((c) => c.taskId === task.id).map((c) => dayOf(c.at)))].sort();
  const gaps = days.slice(1).map((d, i) => daysBetween(days[i], d));
  const since = days.length ? daysBetween(days[days.length - 1], today) : 0;
  if (days.length && since > task.everyDays * 1.3) gaps.push(since);
  const recent = gaps.slice(-3);
  if (recent.length < 3) return null;

  const late = recent.every((g) => g >= task.everyDays * 1.3);
  const early = recent.every((g) => g <= task.everyDays * 0.7);
  if (!late && !early) return null;

  const steps = FREQUENCIES.map((f) => f.days);
  const next = late ? steps.find((d) => d > task.everyDays) : [...steps].reverse().find((d) => d < task.everyDays);
  if (next === undefined) return null;
  const typical = median(recent);
  if (Math.abs(next - typical) >= Math.abs(task.everyDays - typical)) return null;
  return { everyDays: next, why: late ? 'late' : 'early', typical: Math.round(typical) };
}
