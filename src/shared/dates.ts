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

const CROCKFORD = '0123456789abcdefghjkmnpqrstvwxyz';

/**
 * A ULID: 26 characters, the time first so ids sort by when they were made. The phone makes ids
 * while offline, and the server stores them as they are, so they need to be unique everywhere.
 * (Records made before sync have shorter ids; the server takes those too.)
 */
export function newId(now: number = Date.now()): string {
  let t = now;
  let time = '';
  for (let i = 0; i < 10; i++) {
    time = CROCKFORD[t % 32] + time;
    t = Math.floor(t / 32);
  }
  let random = '';
  for (let i = 0; i < 16; i++) random += CROCKFORD[Math.floor(Math.random() * 32)];
  return time + random;
}
