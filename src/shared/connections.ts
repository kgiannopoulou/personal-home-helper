/**
 * Cross-module tips: the things no single module can see on its own.
 * Pure functions over a plain snapshot, so they're easy to test and, later, to hand to the AI hub.
 */

export interface Snapshot {
  now: Date;
  /** Today's calendar events */
  events: { title: string; start: string; end: string; allDay: boolean }[];
  /** Minutes booked in the calendar today */
  busyMinutes: number;
  /** Rain expected later today, e.g. "14:00–17:00" */
  rainWindow: string | null;
  /** Minutes until the next workout from the Activity schedule */
  workoutInMinutes: number | null;
  waterMl: number;
  waterGoal: number;
  /** Kitchen items to use today or tomorrow */
  expiringSoon: string[];
  recipe: { name: string; emoji: string; usesSoon: string[] } | null;
  /** Unticked shopping-list items */
  shoppingItems: string[];
  shoppingEstimate: number;
  trip: { destination: string; days: number } | null;
  choresPlannedMinutes: number;
  /** Money left in this month's budget, null without a budget */
  budgetLeft: number | null;
  currency: string;
  indoorHumidity: number | null;
  humidityLow: number;
}

export interface Connection {
  id: string;
  emoji: string;
  text: string;
  /** Where to act on it */
  href: string;
}

const WORKOUT = /\b(gym|workout|training|run|running|jog|yoga|pilates|swim|swimming|football|tennis|spin|crossfit|cycling|hiit)\b/i;
const OUTDOOR = /\b(run|running|jog|football|tennis|cycling|hike|walk)\b/i;
const FRESH = /\b(milk|bread|yogh?urt|banana|salad|lettuce|spinach|berries|cream|fresh)/i;

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const fmtMoney = (n: number, c: string) => `${c}${Math.abs(n).toFixed(2)}`;

/** The next workout today, from the calendar first, else from the Activity schedule. */
export function nextWorkout(s: Snapshot): { title: string; at: Date; minutes: number } | null {
  const fromCalendar = s.events
    .filter((e) => !e.allDay && WORKOUT.test(e.title) && new Date(e.start) > s.now)
    .sort((a, b) => a.start.localeCompare(b.start))[0];
  if (fromCalendar) {
    const at = new Date(fromCalendar.start);
    return { title: fromCalendar.title, at, minutes: Math.round((at.getTime() - s.now.getTime()) / 60000) };
  }
  if (s.workoutInMinutes !== null && s.workoutInMinutes <= 12 * 60) {
    return { title: 'Your workout', at: new Date(s.now.getTime() + s.workoutInMinutes * 60000), minutes: s.workoutInMinutes };
  }
  return null;
}

/** How much water you'd expect to have had by now (08:00–22:00 spread evenly). */
export function waterExpected(goal: number, now: Date): number {
  const hours = now.getHours() + now.getMinutes() / 60;
  return Math.round(goal * Math.min(1, Math.max(0, (hours - 8) / 14)));
}

export function connections(s: Snapshot): Connection[] {
  const out: Connection[] = [];

  const workout = nextWorkout(s);
  if (workout) {
    if (workout.minutes > 60 && workout.minutes <= 180) {
      const snack = new Date(workout.at.getTime() - 90 * 60000);
      out.push({
        id: 'fuel',
        emoji: '🍌',
        text: `${workout.title} at ${hhmm(workout.at)}: have a light carb snack ${snack > s.now ? `around ${hhmm(snack)}` : 'now'} (a banana or toast) for energy.`,
        href: '/activity',
      });
    } else if (workout.minutes > 0 && workout.minutes <= 60) {
      out.push({ id: 'fuel', emoji: '💧', text: `${workout.title} at ${hhmm(workout.at)}: sip some water now. No big meal or big gulps before training.`, href: '/activity' });
    }
    if (s.rainWindow && OUTDOOR.test(workout.title)) {
      out.push({ id: 'rain-run', emoji: '🌧️', text: `Rain expected ${s.rainWindow}. Go before it, take a waterproof layer, or train indoors.`, href: '/weather' });
    }
  }

  if (s.expiringSoon.length) {
    const first = s.expiringSoon.slice(0, 2).join(' and ');
    out.push({
      id: 'use-it',
      emoji: '🥬',
      text: s.recipe
        ? `${first} should be used soon. Tonight: ${s.recipe.emoji} ${s.recipe.name}.`
        : `${first} should be used soon. Plan it into today's meals.`,
      href: '/kitchen',
    });
  }

  if (s.trip && s.trip.days <= 7) {
    const fresh = s.shoppingItems.filter((i) => FRESH.test(i));
    if (fresh.length) {
      out.push({
        id: 'trip-fresh',
        emoji: '🧳',
        text: `You leave for ${s.trip.destination} in ${s.trip.days} day${s.trip.days === 1 ? '' : 's'}: skip ${fresh.slice(0, 3).join(', ')} unless you'll finish ${fresh.length > 1 ? 'them' : 'it'} before then.`,
        href: '/shopping',
      });
    }
  }

  if (s.busyMinutes >= 6 * 60 && s.choresPlannedMinutes > 15) {
    out.push({
      id: 'busy',
      emoji: '📅',
      text: `Busy day (${Math.round((s.busyMinutes / 60) * 10) / 10} h booked). Just do the quick chores; lower today's chore time in Chores → Household so the rest moves to a freer day.`,
      href: '/chores',
    });
  }

  const expected = waterExpected(s.waterGoal, s.now);
  if (s.waterGoal > 0 && expected - s.waterMl >= 500) {
    out.push({ id: 'water', emoji: '💧', text: `You're about ${Math.round((expected - s.waterMl) / 50) * 50} ml behind on water. Have a glass now.`, href: '/quick' });
  }

  if (s.budgetLeft !== null && s.shoppingEstimate > 0 && s.shoppingEstimate > s.budgetLeft) {
    out.push({
      id: 'budget',
      emoji: '💶',
      text:
        s.budgetLeft <= 0
          ? `You're over this month's budget, and the shopping list adds about ${fmtMoney(s.shoppingEstimate, s.currency)}. Stick to the essentials.`
          : `The shopping list (≈${fmtMoney(s.shoppingEstimate, s.currency)}) is more than what's left this month (${fmtMoney(s.budgetLeft, s.currency)}).`,
      href: '/money',
    });
  }

  if (s.indoorHumidity !== null && s.indoorHumidity < s.humidityLow) {
    out.push({ id: 'dry', emoji: '💧', text: `The air at home is dry (${Math.round(s.indoorHumidity)}%). Turn on the humidifier.`, href: '/weather/home' });
  }

  return out;
}
