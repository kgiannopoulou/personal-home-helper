import { fromDateKey, toDateKey } from '../../../shared/dates';
import { categorize, normalizeName, type Category } from '../../../shared/homeCore';
import type { InventoryItem, Location } from './types';

// Typical shelf life after purchase, in days. Checked in order, first match wins.
const SHELF_LIFE: [RegExp, { fridge?: number; freezer?: number; pantry?: number }][] = [
  [/\b(chicken|turkey|mince|fish|salmon|prawn|shrimp)/, { fridge: 2, freezer: 90 }],
  [/\b(beef|pork|lamb|steak|sausage|bacon)/, { fridge: 3, freezer: 120 }],
  [/\b(ham|salami|deli)/, { fridge: 5 }],
  [/\b(spinach|lettuce|salad|rocket|herbs?|berries|strawberr|raspberr|blueberr|mushroom)/, { fridge: 5, freezer: 180 }],
  [/\bmilk\b/, { fridge: 7, freezer: 60 }],
  [/\b(oat|soy|almond) milk/, { fridge: 7, pantry: 180 }],
  [/\bcream\b/, { fridge: 7 }],
  [/\b(yogh?urt|skyr|cottage)/, { fridge: 14 }],
  [/\b(feta|mozzarella|ricotta|halloumi)/, { fridge: 7 }],
  [/\bcheese\b/, { fridge: 21 }],
  [/\beggs?\b/, { fridge: 28, pantry: 21 }],
  [/\bbutter\b/, { fridge: 30, freezer: 180 }],
  [/\b(bread|bagel|tortilla|wrap)/, { pantry: 5, freezer: 90 }],
  [/\b(banana|avocado|peach|pear|tomato)/, { pantry: 5, fridge: 7 }],
  [/\b(apple|orange|lemon|lime|carrot|pepper|cucumber|broccoli|courgette|zucchini|grape)/, { fridge: 14, pantry: 7 }],
  [/\b(potato|onion|garlic|sweet potato)/, { pantry: 30 }],
  [/\b(tofu|hummus)/, { fridge: 7 }],
  [/\bjuice\b/, { fridge: 7, pantry: 180 }],
];

export function guessLocation(name: string, category: Category = categorize(name)): Location {
  if (category === 'bathroom') return 'bathroom';
  if (category === 'cleaning') return 'cleaning';
  if (category === 'home' || category === 'pet') return 'other';
  const n = name.toLowerCase();
  if (/\bfrozen\b|ice cream/.test(n)) return 'freezer';
  for (const [pattern, life] of SHELF_LIFE) {
    if (pattern.test(n)) return life.fridge !== undefined && !/\b(banana|potato|onion|garlic|bread|avocado)/.test(n) ? 'fridge' : 'pantry';
  }
  return 'pantry';
}

/** Estimated shelf life in days for this item where it is stored, or undefined if it keeps for ages. */
export function shelfLifeDays(name: string, location: Location): number | undefined {
  if (location === 'bathroom' || location === 'cleaning' || location === 'other') return undefined;
  const n = name.toLowerCase();
  for (const [pattern, life] of SHELF_LIFE) {
    if (!pattern.test(n)) continue;
    // Stored somewhere unusual (e.g. bread in the fridge): use the closest known option.
    if (location === 'freezer') return life.freezer ?? 180;
    if (location === 'fridge') return life.fridge ?? life.pantry;
    return life.pantry ?? life.fridge;
  }
  if (location === 'freezer') return 180;
  return undefined;
}

export function addDays(key: string, days: number): string {
  const d = fromDateKey(key);
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((fromDateKey(to).getTime() - fromDateKey(from).getTime()) / 86400000);
}

export function estimateExpiry(name: string, location: Location, boughtAt: string): string | undefined {
  const days = shelfLifeDays(name, location);
  return days === undefined ? undefined : addDays(boughtAt, days);
}

export type ExpiryStatus = { status: 'expired' | 'today' | 'soon' | 'ok'; daysLeft: number };

export function expiryStatus(item: InventoryItem, today: string = toDateKey()): ExpiryStatus | null {
  if (!item.expiresAt || item.level === 'empty') return null;
  const daysLeft = daysBetween(today, item.expiresAt);
  const status = daysLeft < 0 ? 'expired' : daysLeft === 0 ? 'today' : daysLeft <= 2 ? 'soon' : 'ok';
  return { status, daysLeft };
}

export interface RunOutPrediction {
  /** Average days between purchases */
  everyDays: number;
  /** Estimated YYYY-MM-DD it runs out */
  runsOutOn: string;
  daysLeft: number;
}

/**
 * Learns how often you buy something (needs at least 3 purchases) and predicts
 * when you'll run out: last purchase + average gap between purchases.
 */
export function predictRunOut(item: InventoryItem, today: string = toDateKey()): RunOutPrediction | null {
  const dates = [...new Set(item.purchases)].sort();
  if (dates.length < 3) return null;
  const gaps: number[] = [];
  for (let i = 1; i < dates.length; i++) gaps.push(daysBetween(dates[i - 1], dates[i]));
  const everyDays = Math.max(1, Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length));
  const runsOutOn = addDays(dates[dates.length - 1], everyDays);
  return { everyDays, runsOutOn, daysLeft: daysBetween(today, runsOutOn) };
}

export type BuyReason = 'empty' | 'low' | 'predicted';

export function buyReason(item: InventoryItem, today: string = toDateKey()): BuyReason | null {
  if (item.level === 'empty') return 'empty';
  if (item.level === 'low') return 'low';
  const p = predictRunOut(item, today);
  if (p && p.daysLeft <= 2) return 'predicted';
  return null;
}

export function findItem(items: InventoryItem[], name: string): InventoryItem | undefined {
  const key = normalizeName(name.replace(/^(the|my|some|a|an)\s+/i, ''));
  if (!key) return undefined;
  return (
    items.find((i) => normalizeName(i.name) === key) ??
    items.find((i) => normalizeName(i.name).includes(key) || key.includes(normalizeName(i.name)))
  );
}

export type CommandAction = 'empty' | 'low' | 'bought' | 'half' | 'full';

export interface Command {
  action: CommandAction;
  names: string[];
}

const PATTERNS: [RegExp, CommandAction][] = [
  [/^(?:i\s+)?(?:(?:have\s+)?finished|used up|ran out of|run out of|am out of|'m out of|we're out of|out of|no more)\s+(.+)$/i, 'empty'],
  [/^(.+?)\s+(?:is|are)\s+(?:finished|empty|gone|all gone|used up)$/i, 'empty'],
  [/^(.+?)\s+(?:is|are)\s+(?:running\s+)?low$/i, 'low'],
  [/^(?:running\s+)?low on\s+(.+)$/i, 'low'],
  [/^(.+?)\s+(?:is|are)\s+half(?:\s+full)?$/i, 'half'],
  [/^(?:i\s+)?(?:bought|got|picked up|restocked|added)\s+(.+)$/i, 'bought'],
];

/**
 * Understands short everyday sentences:
 * "I finished the milk", "out of eggs and bread", "dish soap is low",
 * "bought milk, eggs and spinach".
 */
export function parseCommand(text: string): Command | null {
  const clean = text.trim().replace(/[.!]+$/, '');
  for (const [re, action] of PATTERNS) {
    const m = re.exec(clean);
    if (!m) continue;
    const names = m[1]
      .split(/\s*(?:,|\band\b|&|\+)\s*/i)
      .map((s) => s.replace(/^(the|my|some|a|an|all the)\s+/i, '').trim())
      .filter(Boolean);
    if (names.length) return { action, names };
  }
  return null;
}

/** A new item with sensible guesses for category, location and expiry. */
export function newItem(
  name: string,
  opts: Partial<Pick<InventoryItem, 'category' | 'location' | 'quantity' | 'price' | 'expiresAt'>> & { id: string; today?: string; shelfLifeDays?: number },
): InventoryItem {
  const today = opts.today ?? toDateKey();
  const category = opts.category ?? categorize(name);
  const location = opts.location ?? guessLocation(name, category);
  const expiresAt =
    opts.expiresAt ?? (opts.shelfLifeDays ? addDays(today, opts.shelfLifeDays) : estimateExpiry(name, location, today));
  return {
    id: opts.id,
    name: name.trim(),
    category,
    location,
    level: 'full',
    quantity: opts.quantity,
    price: opts.price,
    boughtAt: today,
    expiresAt,
    purchases: [today],
  };
}

/** Marks an existing item as re-bought: full again, new expiry, purchase recorded. */
export function restock(item: InventoryItem, today: string = toDateKey(), extra: Partial<InventoryItem> = {}): InventoryItem {
  return {
    ...item,
    ...extra,
    level: 'full',
    boughtAt: today,
    expiresAt: extra.expiresAt ?? estimateExpiry(item.name, extra.location ?? item.location, today),
    purchases: item.purchases.includes(today) ? item.purchases : [...item.purchases, today],
  };
}
