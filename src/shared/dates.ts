/** Local calendar day as YYYY-MM-DD (not UTC, so late-night meals land on the right day). */
export function toDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** The `days` date keys ending at `end` (inclusive), oldest first. */
export function lastNDays(days: number, end: Date = new Date()): string[] {
  const keys: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end.getFullYear(), end.getMonth(), end.getDate() - i);
    keys.push(toDateKey(d));
  }
  return keys;
}

export function weekdayShort(key: string): string {
  return fromDateKey(key).toLocaleDateString(undefined, { weekday: 'short' });
}

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
