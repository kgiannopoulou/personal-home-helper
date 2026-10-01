import { fromDateKey, newId, toDateKey } from '../../../shared/dates';
import type { Appliance, AppState, Expense, ExpenseCategory, Reward, Settings } from './types';

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'groceries',
  'household',
  'eating_out',
  'transport',
  'bills',
  'health',
  'fun',
  'shopping',
  'other',
];

export const EXPENSE_LABEL: Record<ExpenseCategory, string> = {
  groceries: '🥦 Groceries',
  household: '🧽 Household',
  eating_out: '🍽️ Eating out',
  transport: '🚌 Transport',
  bills: '🧾 Bills',
  health: '💊 Health',
  fun: '🎉 Fun',
  shopping: '🛍️ Shopping',
  other: '📦 Other',
};

export function money(amount: number, currency: string): string {
  const fixed = Math.abs(amount).toFixed(2);
  return `${amount < 0 ? '-' : ''}${currency}${fixed}`;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// Checked in order: "coffee beans" at the supermarket is still groceries, but "coffee" alone is eating out.
const KEYWORDS: [ExpenseCategory, string[]][] = [
  ['groceries', ['lidl', 'aldi', 'tesco', 'supermarket', 'grocer', 'groceries', 'market', 'carrefour', 'sainsbury', 'spar', 'bakery', 'butcher']],
  ['household', ['detergent', 'cleaning', 'ikea', 'dish soap', 'toilet paper', 'household', 'hardware', 'light bulb']],
  ['eating_out', ['lunch', 'dinner', 'breakfast', 'restaurant', 'cafe', 'café', 'coffee', 'takeaway', 'pizza', 'burger', 'sushi', 'bar', 'drinks', 'brunch', 'delivery', 'kebab']],
  ['transport', ['bus', 'train', 'metro', 'tram', 'taxi', 'uber', 'bolt', 'petrol', 'fuel', 'gas', 'parking', 'ticket', 'toll', 'bike']],
  ['bills', ['rent', 'electricity', 'water bill', 'internet', 'phone', 'insurance', 'netflix', 'spotify', 'subscription', 'gym', 'mortgage', 'heating', 'council']],
  ['health', ['pharmacy', 'doctor', 'dentist', 'medicine', 'vitamins', 'physio', 'optician', 'chemist']],
  ['fun', ['cinema', 'movie', 'concert', 'game', 'book', 'museum', 'theatre', 'festival', 'hobby', 'gift', 'present']],
  ['shopping', ['clothes', 'shoes', 'zara', 'h&m', 'amazon', 'shirt', 'jacket', 'dress', 'electronics', 'makeup', 'skincare']],
];

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const PATTERNS: [ExpenseCategory, RegExp][] = KEYWORDS.map(([c, words]) => [
  c,
  new RegExp(`(^|[^a-z])(${words.map(escapeRegExp).join('|')})(s|es)?($|[^a-z])`),
]);

export function guessCategory(text: string): ExpenseCategory {
  const t = text.toLowerCase();
  for (const [c, p] of PATTERNS) if (p.test(t)) return c;
  return 'other';
}

/**
 * Understands quick entries like "12.50 lunch", "lunch 12,50", "€30 petrol" or "Lidl 23.40".
 * Returns null when there's no amount.
 */
export function parseExpense(text: string): { amount: number; note?: string; category: ExpenseCategory } | null {
  const t = text.trim();
  const matches = [...t.matchAll(/([€£$]\s*)?(\d+(?:[.,]\d{1,2})?)(\s*(?:€|eur|euros?|£|\$)(?![a-z]))?/gi)];
  if (!matches.length) return null;
  // "2 coffees 7.50": prefer an amount with a currency sign, then one with cents, then the last number.
  const match =
    matches.find((m) => m[1] || m[3]) ?? matches.find((m) => /[.,]/.test(m[2])) ?? matches[matches.length - 1];
  const amount = round2(Number(match[2].replace(',', '.')));
  if (!(amount > 0)) return null;
  const note = (t.slice(0, match.index) + ' ' + t.slice((match.index ?? 0) + match[0].length))
    .replace(/\s+/g, ' ')
    .replace(/^(on|for|at)\s+/i, '')
    .trim();
  const cleanNote = note ? note[0].toUpperCase() + note.slice(1) : undefined;
  return { amount, note: cleanNote, category: guessCategory(note) };
}

/** YYYY-MM for a date key or Date. */
export function monthKey(d: Date | string = new Date()): string {
  const date = typeof d === 'string' ? fromDateKey(d) : d;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function shiftMonth(key: string, by: number): string {
  const [y, m] = key.split('-').map(Number);
  return monthKey(new Date(y, m - 1 + by, 1));
}

export function daysInMonth(key: string): number {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

export function monthName(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export function inMonth(expenses: Expense[], key: string): Expense[] {
  return expenses.filter((e) => e.date.startsWith(key));
}

export function sum(expenses: Expense[]): number {
  return round2(expenses.reduce((t, e) => t + e.amount, 0));
}

export function byCategory(expenses: Expense[]): Record<ExpenseCategory, number> {
  const out = Object.fromEntries(EXPENSE_CATEGORIES.map((c) => [c, 0])) as Record<ExpenseCategory, number>;
  for (const e of expenses) out[e.category] = round2(out[e.category] + e.amount);
  return out;
}

/** Monday of the week containing `d`. */
export function weekStart(d: Date): Date {
  const day = (d.getDay() + 6) % 7;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
}

export interface MonthSummary {
  month: string;
  total: number;
  byCategory: Record<ExpenseCategory, number>;
  /** Average spent by this day of the month in previous months that have data (up to 3), or null */
  usualByNow: number | null;
  /** Average full-month total of those months */
  averageMonth: number | null;
  /** Where this month will end at the current pace (fixed bills counted once) */
  projected: number;
  daysLeft: number;
  /** Budget left (negative = over), null without a budget */
  remaining: number | null;
  /** What you can spend per day for the rest of the month */
  perDay: number | null;
  lastMonth: number;
  /** Groceries + household this week (Mon–Sun) */
  groceriesThisWeek: number;
}

export function monthSummary(expenses: Expense[], settings: Settings, today: Date = new Date()): MonthSummary {
  const month = monthKey(today);
  const day = today.getDate();
  const dim = daysInMonth(month);
  const current = inMonth(expenses, month);
  const total = sum(current);

  const previous = [1, 2, 3].map((i) => shiftMonth(month, -i)).filter((m) => inMonth(expenses, m).length > 0);
  const byNow = previous.map((m) =>
    sum(inMonth(expenses, m).filter((e) => Number(e.date.slice(8, 10)) <= Math.min(day, daysInMonth(m)))),
  );
  const full = previous.map((m) => sum(inMonth(expenses, m)));
  const avg = (xs: number[]) => (xs.length ? round2(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

  // Recurring bills happen once, so only day-to-day spending is extrapolated.
  const fixed = sum(current.filter((e) => e.source === 'recurring'));
  const variable = total - fixed;
  const projected = round2(fixed + (variable / day) * dim);

  const daysLeft = dim - day + 1;
  const remaining = settings.monthlyBudget > 0 ? round2(settings.monthlyBudget - total) : null;
  const perDay = remaining !== null ? round2(Math.max(0, remaining) / daysLeft) : null;

  const ws = toDateKey(weekStart(today));
  const groceriesThisWeek = sum(
    expenses.filter((e) => e.date >= ws && e.date <= toDateKey(today) && (e.category === 'groceries' || e.category === 'household')),
  );

  return {
    month,
    total,
    byCategory: byCategory(current),
    usualByNow: avg(byNow),
    averageMonth: avg(full),
    projected,
    daysLeft,
    remaining,
    perDay,
    lastMonth: sum(inMonth(expenses, shiftMonth(month, -1))),
    groceriesThisWeek,
  };
}

/** Plain-language insights for the overview, most important first. */
export function insights(s: MonthSummary, settings: Settings, rewards: Reward[], today: Date = new Date()): string[] {
  const c = settings.currency;
  const out: string[] = [];

  if (s.usualByNow !== null && s.total > 0) {
    const diff = round2(s.total - s.usualByNow);
    if (Math.abs(diff) >= 5) {
      out.push(
        diff > 0
          ? `📈 You've spent ${money(diff, c)} more than usual by this point in the month.`
          : `📉 You've spent ${money(-diff, c)} less than usual by this point in the month. Nice!`,
      );
    }
  }

  if (settings.monthlyBudget > 0 && s.total > 0) {
    if (s.remaining !== null && s.remaining < 0) {
      out.push(`⚠️ You're ${money(-s.remaining, c)} over your monthly budget.`);
    } else if (s.projected > settings.monthlyBudget * 1.03 && today.getDate() >= 5) {
      out.push(`🔮 At this pace you'll spend about ${money(s.projected, c)} this month (budget ${money(settings.monthlyBudget, c)}).`);
    } else if (s.perDay !== null) {
      out.push(`✅ On track: you can spend ${money(s.perDay, c)} a day for the rest of the month.`);
    }
  }

  for (const cat of EXPENSE_CATEGORIES) {
    const limit = settings.categoryBudgets[cat];
    if (!limit) continue;
    const spent = s.byCategory[cat];
    if (spent > limit) out.push(`${EXPENSE_LABEL[cat]}: ${money(spent, c)} of ${money(limit, c)}, ${money(spent - limit, c)} over.`);
    else if (spent > limit * 0.85) out.push(`${EXPENSE_LABEL[cat]}: almost at the limit (${money(spent, c)} of ${money(limit, c)}).`);
  }

  if (settings.weeklyGroceries > 0 && s.groceriesThisWeek > settings.weeklyGroceries) {
    out.push(`🛒 Groceries this week: ${money(s.groceriesThisWeek, c)}, ${money(s.groceriesThisWeek - settings.weeklyGroceries, c)} over your weekly budget.`);
  }

  const reward = suggestReward(s, settings, rewards);
  if (reward) out.push(reward);

  return out;
}

/**
 * When you saved money, suggest the most expensive wishlist item you can afford with the savings
 * ("You spent €60 less than your budget last month, treat yourself to a new book!").
 */
export function suggestReward(s: MonthSummary, settings: Settings, rewards: Reward[]): string | null {
  if (settings.monthlyBudget <= 0) return null;
  const c = settings.currency;
  const saved = s.lastMonth > 0 ? round2(settings.monthlyBudget - s.lastMonth) : 0;
  const pick = (amount: number) =>
    [...rewards].filter((r) => r.price <= amount).sort((a, b) => b.price - a.price)[0] as Reward | undefined;

  if (saved > 0) {
    const r = pick(saved);
    if (r) return `🎁 You spent ${money(saved, c)} less than your budget last month. Treat yourself to ${r.name} (${money(r.price, c)})!`;
    if (!rewards.length && saved >= 20)
      return `🎁 You spent ${money(saved, c)} less than your budget last month. Reward yourself, maybe with a new book? Add rewards in Settings.`;
  }
  return null;
}

/** Totals for the last `n` months, oldest first, for the chart. */
export function monthHistory(expenses: Expense[], n: number, today: Date = new Date()): { month: string; total: number }[] {
  const now = monthKey(today);
  return Array.from({ length: n }, (_, i) => shiftMonth(now, i - n + 1)).map((month) => ({
    month,
    total: sum(inMonth(expenses, month)),
  }));
}

/**
 * Adds this month's recurring bills whose day has come and that weren't added yet.
 * Past months are never backfilled.
 */
export function applyRecurring(state: AppState, today: Date = new Date()): AppState {
  const month = monthKey(today);
  const added: Expense[] = [];
  for (const r of state.recurring) {
    if (today.getDate() < r.dayOfMonth) continue;
    const exists = state.expenses.some((e) => e.recurringId === r.id && e.date.startsWith(month));
    if (exists) continue;
    added.push({
      id: newId(),
      date: `${month}-${String(r.dayOfMonth).padStart(2, '0')}`,
      amount: r.amount,
      category: r.category,
      note: r.name,
      source: 'recurring',
      recurringId: r.id,
    });
  }
  return added.length ? { ...state, expenses: [...state.expenses, ...added] } : state;
}

// ---------- Energy ----------

export const APPLIANCE_PRESETS: Omit<Appliance, 'id'>[] = [
  { name: 'Electric heater', kw: 2, hoursPerDay: 4, daysPerMonth: 30 },
  { name: 'Oil radiator', kw: 1.5, hoursPerDay: 5, daysPerMonth: 30 },
  { name: 'Heat pump / AC (heating)', kw: 1, hoursPerDay: 6, daysPerMonth: 30 },
  { name: 'Air conditioner (cooling)', kw: 1, hoursPerDay: 4, daysPerMonth: 30 },
  { name: 'Electric blanket', kw: 0.1, hoursPerDay: 2, daysPerMonth: 30 },
  { name: 'Humidifier', kw: 0.03, hoursPerDay: 8, daysPerMonth: 30 },
  { name: 'Dehumidifier', kw: 0.3, hoursPerDay: 6, daysPerMonth: 30 },
  { name: 'Tumble dryer', kw: 2.5, hoursPerDay: 1, daysPerMonth: 8 },
];

export function applianceCost(a: Pick<Appliance, 'kw' | 'hoursPerDay' | 'daysPerMonth'>, kwhPrice: number) {
  const kwhPerDay = a.kw * a.hoursPerDay;
  return {
    kwhPerMonth: round2(kwhPerDay * a.daysPerMonth),
    perDay: round2(kwhPerDay * kwhPrice),
    perMonth: round2(kwhPerDay * a.daysPerMonth * kwhPrice),
    /** Saved per month by running it one hour less a day */
    oneHourLess: a.hoursPerDay >= 1 ? round2(a.kw * a.daysPerMonth * kwhPrice) : 0,
  };
}

export function energyTotal(appliances: Appliance[], kwhPrice: number): number {
  return round2(appliances.reduce((t, a) => t + applianceCost(a, kwhPrice).perMonth, 0));
}
