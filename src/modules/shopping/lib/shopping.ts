import { fromDateKey, toDateKey } from '../../../shared/dates';
import { CATEGORIES, normalizeName, type Category } from '../../../shared/homeCore';
import type { AppState, ListItem, Trip } from './types';

// Rough typical supermarket prices (EUR) used until you enter real ones.
const TYPICAL_PRICES: [RegExp, number][] = [
  [/\bmilk\b/, 1.2],
  [/\beggs?\b/, 2.5],
  [/\bbread\b/, 1.8],
  [/\bbutter\b/, 2.5],
  [/\bcheese\b/, 3],
  [/\b(yogh?urt|skyr)/, 1.5],
  [/\bchicken\b/, 6],
  [/\b(beef|mince|steak)/, 6.5],
  [/\b(salmon|fish)/, 7],
  [/\btuna\b/, 1.5],
  [/\brice\b/, 2],
  [/\bpasta\b/, 1.3],
  [/\b(banana|apple|orange|tomato|potato|onion|carrot|pepper|cucumber|spinach|lettuce|broccoli|fruit|veg)/, 1.8],
  [/\b(lentil|bean|chickpea)/, 1.2],
  [/\btofu\b/, 2.5],
  [/\b(oats|cereal|granola)/, 2.5],
  [/\bcoffee\b/, 5],
  [/\btea\b/, 2.5],
  [/\bjuice\b/, 2],
  [/\bwater\b/, 1],
  [/\b(dish soap|washing up)/, 2],
  [/\b(detergent|laundry)/, 8],
  [/\bsoftener\b/, 3],
  [/\b(sponge|cloth)/, 1.5],
  [/\b(cleaner|spray|bleach)/, 2.5],
  [/\btoilet (paper|roll)/, 4],
  [/\b(shampoo|conditioner|shower gel)/, 3.5],
  [/\btoothpaste\b/, 2.5],
  [/\bdeodorant\b/, 3],
  [/\b(trash|bin|rubbish) bags?/, 3],
  [/\b(kitchen roll|paper towel)/, 3],
  [/\bbatter(y|ies)/, 5],
  [/\bbulbs?\b/, 4],
  [/\b(dog|cat) food/, 8],
  [/\b(cat )?litter\b/, 6],
];

export function typicalPrice(name: string): number | undefined {
  const n = name.toLowerCase();
  return TYPICAL_PRICES.find(([re]) => re.test(n))?.[1];
}

/** Your own price for the item, else what you paid last time, else a typical price. */
export function estimatePrice(item: Pick<ListItem, 'name' | 'price'>, prices: AppState['prices']): number | undefined {
  return item.price ?? prices[normalizeName(item.name)] ?? typicalPrice(item.name);
}

export interface ListEstimate {
  total: number;
  /** Items with no price information at all */
  unknown: number;
}

export function estimateList(items: ListItem[], prices: AppState['prices']): ListEstimate {
  let total = 0;
  let unknown = 0;
  for (const i of items) {
    if (i.checked) continue;
    const p = estimatePrice(i, prices);
    if (p === undefined) unknown++;
    else total += p;
  }
  return { total: Math.round(total * 100) / 100, unknown };
}

export function groupByCategory(items: ListItem[]): { category: Category; items: ListItem[] }[] {
  return CATEGORIES.map((category) => ({
    category,
    // Unchecked first, then alphabetical
    items: items
      .filter((i) => i.category === category)
      .sort((a, b) => Number(a.checked) - Number(b.checked) || a.name.localeCompare(b.name)),
  })).filter((g) => g.items.length > 0);
}

/** Monday of the week containing `key`. */
export function weekStart(key: string): string {
  const d = fromDateKey(key);
  const offset = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - offset);
  return toDateKey(d);
}

export interface SpendSummary {
  thisWeek: number;
  lastWeek: number;
  /** Average of the previous 4 weeks that had any spending, or null if none */
  averageWeek: number | null;
  thisMonth: number;
  /** thisWeek minus averageWeek */
  diffVsAverage: number | null;
  /** Totals for the last 8 weeks, oldest first */
  weeks: { start: string; total: number }[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function spendSummary(trips: Trip[], today: string = toDateKey()): SpendSummary {
  const current = weekStart(today);
  const weeks: { start: string; total: number }[] = [];
  for (let i = 7; i >= 0; i--) {
    const d = fromDateKey(current);
    d.setDate(d.getDate() - 7 * i);
    weeks.push({ start: toDateKey(d), total: 0 });
  }
  const byWeek = new Map(weeks.map((w) => [w.start, w]));
  const month = today.slice(0, 7);
  let thisMonth = 0;
  for (const t of trips) {
    const w = byWeek.get(weekStart(t.date));
    if (w) w.total += t.total;
    if (t.date.startsWith(month)) thisMonth += t.total;
  }
  for (const w of weeks) w.total = round2(w.total);
  const previous = weeks.slice(-5, -1).filter((w) => w.total > 0);
  const averageWeek = previous.length ? round2(previous.reduce((s, w) => s + w.total, 0) / previous.length) : null;
  const thisWeek = weeks[weeks.length - 1].total;
  return {
    thisWeek,
    lastWeek: weeks[weeks.length - 2].total,
    averageWeek,
    thisMonth: round2(thisMonth),
    diffVsAverage: averageWeek === null ? null : round2(thisWeek - averageWeek),
    weeks,
  };
}

export function money(amount: number, currency: string): string {
  return `${currency}${amount.toFixed(2)}`;
}

/** Friendly one-liners about spending, like "You spent €12 more than your average". */
export function spendingInsights(s: SpendSummary, settings: AppState['settings'], today: string = toDateKey()): string[] {
  const c = settings.currency;
  const out: string[] = [];
  if (s.diffVsAverage !== null && Math.abs(s.diffVsAverage) >= 1) {
    out.push(
      s.diffVsAverage > 0
        ? `📈 You spent ${money(s.diffVsAverage, c)} more this week than your average (${money(s.averageWeek!, c)}).`
        : `📉 You spent ${money(-s.diffVsAverage, c)} less this week than your average. Nice!`,
    );
  }
  if (settings.weeklyBudget > 0) {
    const left = settings.weeklyBudget - s.thisWeek;
    out.push(
      left >= 0
        ? `💶 ${money(left, c)} left of your ${money(settings.weeklyBudget, c)} weekly budget.`
        : `⚠️ ${money(-left, c)} over your weekly budget.`,
    );
  }
  if (settings.monthlyBudget > 0) {
    const d = fromDateKey(today);
    const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const expected = (settings.monthlyBudget * d.getDate()) / daysInMonth;
    if (s.thisMonth > settings.monthlyBudget) out.push(`⚠️ ${money(s.thisMonth - settings.monthlyBudget, c)} over this month's budget.`);
    else if (s.thisMonth < expected * 0.85 && d.getDate() >= 20)
      out.push(`🎁 You're well under budget this month. Treat yourself to something small (a new book?).`);
    else out.push(`🗓️ ${money(s.thisMonth, c)} of ${money(settings.monthlyBudget, c)} spent this month.`);
  }
  return out;
}

/** Things you often buy that aren't on the list yet. */
export function quickAdds(history: AppState['history'], items: ListItem[], limit = 8): string[] {
  const onList = new Set(items.map((i) => normalizeName(i.name)));
  return Object.entries(history)
    .filter(([key, h]) => !onList.has(key) && h.count >= 2)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, limit)
    .map(([, h]) => h.name);
}

/** Splits "milk, eggs and bread" or "2 x milk" into items. */
export function parseItems(text: string): { name: string; quantity?: string }[] {
  return text
    .split(/\s*(?:,|;|\n|\band\b)\s*/i)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const m = /^(\d+(?:[.,]\d+)?\s*(?:x|kg|g|l|ml|pack|packs|bottles?|cans?)?)\s+(.+)$/i.exec(s);
      return m ? { name: capitalize(m[2]), quantity: m[1].replace(/\s+/g, ' ') } : { name: capitalize(s) };
    });
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
