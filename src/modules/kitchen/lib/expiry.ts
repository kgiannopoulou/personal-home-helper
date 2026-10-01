import { fromDateKey } from '../../../shared/dates';
import { suggestRecipes } from './recipes';
import type { InventoryItem } from './types';

export interface ExpiryNotice {
  at: Date;
  title: string;
  body: string;
}

/** Groups items by expiry date into morning-before notices within the next 30 days. */
export function expiryDigest(items: InventoryItem[], now: Date, hour = 9): ExpiryNotice[] {
  const byDate = new Map<string, InventoryItem[]>();
  for (const item of items) {
    if (!item.expiresAt || item.level === 'empty') continue;
    const list = byDate.get(item.expiresAt) ?? [];
    list.push(item);
    byDate.set(item.expiresAt, list);
  }
  const notices: ExpiryNotice[] = [];
  const horizon = now.getTime() + 30 * 86400000;
  for (const [date, list] of [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const at = fromDateKey(date);
    at.setDate(at.getDate() - 1);
    at.setHours(hour, 0, 0, 0);
    if (at.getTime() <= now.getTime() || at.getTime() > horizon) continue;
    const names = list.map((i) => i.name);
    const recipe = suggestRecipes(items, date, 1)[0];
    notices.push({
      at,
      title: `⚠️ Use soon: ${names.slice(0, 3).join(', ')}${names.length > 3 ? ` +${names.length - 3}` : ''}`,
      body: recipe
        ? `${names.length === 1 ? 'It expires' : 'They expire'} tomorrow. Tonight's idea: ${recipe.recipe.emoji} ${recipe.recipe.name}`
        : `${names.length === 1 ? 'It expires' : 'They expire'} tomorrow. Plan a meal around ${names.length === 1 ? 'it' : 'them'}.`,
    });
  }
  return notices;
}
