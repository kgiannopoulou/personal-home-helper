import { fromDateKey, toDateKey } from '../../../shared/dates';
import type { AdminItem, CalEvent, Person, Todo } from './types';

const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;

export const time = (d: Date | string) =>
  (typeof d === 'string' ? new Date(d) : d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export function addDays(key: string, days: number): string {
  const d = fromDateKey(key);
  return toDateKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + days));
}

/** Whole days from `from` to `to` (date keys). */
export function daysBetween(from: string, to: string): number {
  return Math.round((fromDateKey(to).getTime() - fromDateKey(from).getTime()) / DAY);
}

export function weekStart(key: string): string {
  const d = fromDateKey(key);
  return addDays(key, -((d.getDay() + 6) % 7));
}

export function prettyDay(key: string, today: string = toDateKey()): string {
  const diff = daysBetween(today, key);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return fromDateKey(key).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

// ---------- Calendar ----------

/** First and last local day of an event (all-day events end at midnight after their last day). */
export function eventDays(e: CalEvent): [string, string] {
  const start = toDateKey(new Date(e.start));
  const endDate = new Date(e.end);
  let end = toDateKey(endDate);
  if (e.allDay || (endDate.getHours() === 0 && endDate.getMinutes() === 0 && end > start)) end = addDays(end, -1);
  return [start, end < start ? start : end];
}

function dayBounds(key: string): [number, number] {
  const start = fromDateKey(key).getTime();
  const d = fromDateKey(key);
  return [start, new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime()];
}

/** Events that touch this day, all-day ones first, then by start time. */
export function eventsOn(events: CalEvent[], key: string): CalEvent[] {
  const [from, to] = dayBounds(key);
  return events
    .filter((e) => new Date(e.start).getTime() < to && new Date(e.end).getTime() > from)
    .sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.localeCompare(b.start));
}

/** Busy intervals inside your waking hours, merged so overlapping meetings count once. */
function busyIntervals(events: CalEvent[], key: string, dayStart: number, dayEnd: number): [number, number][] {
  const d = fromDateKey(key);
  const wake = new Date(d.getFullYear(), d.getMonth(), d.getDate(), dayStart).getTime();
  const sleep = new Date(d.getFullYear(), d.getMonth(), d.getDate(), dayEnd).getTime();
  const raw = eventsOn(events, key)
    .filter((e) => !e.allDay)
    .map((e) => [Math.max(wake, new Date(e.start).getTime()), Math.min(sleep, new Date(e.end).getTime())] as [number, number])
    .filter(([a, b]) => b > a)
    .sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const iv of raw) {
    const last = merged[merged.length - 1];
    if (last && iv[0] <= last[1]) last[1] = Math.max(last[1], iv[1]);
    else merged.push([...iv]);
  }
  return merged;
}

export function busyMinutes(events: CalEvent[], key: string, dayStart: number, dayEnd: number): number {
  return Math.round(busyIntervals(events, key, dayStart, dayEnd).reduce((m, [a, b]) => m + (b - a), 0) / MIN);
}

export interface Gap {
  start: Date;
  end: Date;
  minutes: number;
}

/** Free time between events in your waking hours. For today, only what's left from `now`. */
export function freeGaps(events: CalEvent[], key: string, dayStart: number, dayEnd: number, now?: Date, minMinutes = 30): Gap[] {
  const d = fromDateKey(key);
  let cursor = new Date(d.getFullYear(), d.getMonth(), d.getDate(), dayStart).getTime();
  const sleep = new Date(d.getFullYear(), d.getMonth(), d.getDate(), dayEnd).getTime();
  if (now && toDateKey(now) === key) cursor = Math.max(cursor, Math.ceil(now.getTime() / (5 * MIN)) * 5 * MIN);
  const gaps: Gap[] = [];
  const push = (a: number, b: number) => {
    const minutes = Math.round((b - a) / MIN);
    if (minutes >= minMinutes) gaps.push({ start: new Date(a), end: new Date(b), minutes });
  };
  for (const [a, b] of busyIntervals(events, key, dayStart, dayEnd)) {
    if (a > cursor) push(cursor, a);
    cursor = Math.max(cursor, b);
  }
  if (sleep > cursor) push(cursor, sleep);
  return gaps;
}

// ---------- To-dos ----------

export const openTodos = (todos: Todo[]) => todos.filter((t) => !t.done);

/** Overdue and due-today first, then by due date, undated last. */
export function sortTodos(todos: Todo[]): Todo[] {
  return [...todos].sort((a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999') || a.createdAt.localeCompare(b.createdAt));
}

export function todosDueBy(todos: Todo[], key: string): Todo[] {
  return sortTodos(openTodos(todos).filter((t) => t.due && t.due <= key));
}

/** Puts to-dos (most urgent first) into free gaps where they fit. Untimed to-dos count as 15 minutes. */
export function fitTodos(todos: Todo[], gaps: Gap[]): { todo: Todo; gap: Gap }[] {
  const left = gaps.map((g) => g.minutes);
  const out: { todo: Todo; gap: Gap }[] = [];
  for (const todo of sortTodos(openTodos(todos))) {
    const need = todo.minutes ?? 15;
    const i = left.findIndex((m) => m >= need);
    if (i < 0) continue;
    left[i] -= need;
    out.push({ todo, gap: gaps[i] });
  }
  return out;
}

// ---------- Life admin ----------

export const ADMIN_LABEL = { bill: '💶 Bill', appointment: '🦷 Appointment', renewal: '📄 Renewal', other: '📋 Other' } as const;

export function addMonths(key: string, months: number): string {
  const d = fromDateKey(key);
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1);
  // 31 Jan + 1 month = 28/29 Feb, not 3 Mar.
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return toDateKey(new Date(target.getFullYear(), target.getMonth(), Math.min(d.getDate(), lastDay)));
}

export function adminDueIn(item: AdminItem, today: string): number {
  return daysBetween(today, item.due);
}

/** Admin you should think about now: overdue or inside its reminder window. */
export function adminToRemind(items: AdminItem[], today: string): AdminItem[] {
  return items
    .filter((i) => !i.done && adminDueIn(i, today) <= i.remindDays)
    .sort((a, b) => a.due.localeCompare(b.due));
}

/** Marks it done: repeating items move to their next date after today, one-offs are closed. */
export function completeAdmin(item: AdminItem, now: Date = new Date()): AdminItem {
  const history = [...item.history, now.toISOString()].slice(-24);
  if (!item.repeatMonths) return { ...item, done: true, history };
  const today = toDateKey(now);
  let due = addMonths(item.due, item.repeatMonths);
  while (due <= today) due = addMonths(due, item.repeatMonths);
  return { ...item, due, history };
}

export function adminDueText(item: AdminItem, today: string): string {
  if (item.done) return 'Done';
  const d = adminDueIn(item, today);
  if (d < 0) return `${-d} day${d === -1 ? '' : 's'} overdue`;
  if (d === 0) return 'Due today';
  if (d === 1) return 'Due tomorrow';
  return `Due in ${d} days`;
}

// ---------- Birthdays ----------

export function nextBirthday(person: Person, today: string): { date: string; daysUntil: number; turning?: number } {
  const [m, d] = person.birthday.split('-').map(Number);
  const t = fromDateKey(today);
  const make = (y: number) => {
    // 29 Feb birthdays are celebrated on 28 Feb in other years.
    const last = new Date(y, m, 0).getDate();
    return toDateKey(new Date(y, m - 1, Math.min(d, last)));
  };
  let year = t.getFullYear();
  let date = make(year);
  if (date < today) date = make(++year);
  return { date, daysUntil: daysBetween(today, date), turning: person.year ? year - person.year : undefined };
}

export function upcomingBirthdays(people: Person[], today: string, withinDays: number) {
  return people
    .map((person) => ({ person, ...nextBirthday(person, today) }))
    .filter((b) => b.daysUntil <= withinDays)
    .sort((a, b) => a.daysUntil - b.daysUntil);
}

/** Finds birthdays in calendar events: "Mom's birthday", "Birthday: Alex", "Maria bday 🎂". */
export function birthdaysFromEvents(events: CalEvent[]): { name: string; birthday: string }[] {
  const found = new Map<string, string>();
  for (const e of events) {
    const title = e.title.replace(/🎂|🎉|🎁/g, '').trim();
    const m =
      title.match(/^(.+?)(?:'s|’s|s')?\s+(?:birthday|bday|b-day)\b/i) ?? title.match(/^(?:birthday|bday)\s*[:\-–]?\s*(?:of\s+)?(.+)$/i);
    if (!m) continue;
    const name = m[1].trim().replace(/[:\-–]$/, '').trim();
    if (!name || name.length > 40) continue;
    const [start] = eventDays(e);
    found.set(name.toLowerCase(), JSON.stringify({ name: name[0].toUpperCase() + name.slice(1), birthday: start.slice(5) }));
  }
  return [...found.values()].map((v) => JSON.parse(v));
}

const GIFT_IDEAS: [RegExp, string[]][] = [
  [/cook|bak|food|kitchen/i, ['A cookbook from a cuisine they love', 'A good chef’s knife', 'A cooking class for two', 'Fancy olive oil & spice set']],
  [/garden|plant|flower/i, ['A herb-growing kit', 'Quality gardening gloves and tools', 'A beautiful plant pot', 'A rare plant for their collection']],
  [/read|book|novel/i, ['A book by their favourite author', 'A bookshop gift card', 'A reading light', 'A literary subscription box']],
  [/music|concert|guitar|piano|sing/i, ['Concert tickets', 'Wireless headphones', 'Vinyl of a favourite album', 'A music lesson']],
  [/sport|gym|run|fitness|yoga|hik/i, ['A sports water bottle', 'Running socks or a running belt', 'A yoga mat', 'A day hike with a picnic']],
  [/travel|trip/i, ['A packing-cube set', 'A scratch-off world map', 'A weekend-away voucher', 'A travel journal']],
  [/coffee|tea/i, ['Specialty coffee beans or tea selection', 'A nice mug', 'A pour-over or tea set']],
  [/art|draw|paint|craft/i, ['Quality sketchbook and pens', 'A painting workshop', 'A watercolour set']],
  [/game|gaming/i, ['A new board game', 'A gaming gift card', 'A puzzle']],
  [/wine|cocktail|beer/i, ['A wine-tasting experience', 'A cocktail kit', 'A local craft-beer selection']],
];

/** Offline gift ideas from interest keywords (the AI gives better ones). */
export function quickGiftIdeas(interests: string): string[] {
  const ideas = GIFT_IDEAS.filter(([re]) => re.test(interests)).flatMap(([, list]) => list.slice(0, 3));
  return ideas.length ? ideas.slice(0, 6) : ['An experience together (dinner, a show, a day trip)', 'A framed photo of a shared memory', 'Something handmade'];
}

// ---------- Trips ----------

export interface Trip {
  key: string;
  title: string;
  destination: string;
  /** YYYY-MM-DD */
  start: string;
  end: string;
  nights: number;
  flight: boolean;
}

const TRIP_WORDS = /✈️|🧳|\b(flight|fly to|trip|travel|holiday|vacation|getaway|weekend in|city break)\b/i;
// "Bank holiday" is a day off, not a trip.
const NOT_TRIP = /\b(bank|public|national|school|federal)\s+holiday/i;
const FLIGHT_WORDS = /✈️|\b(flight|fly|airport|abroad)\b/i;

/** Trips in your calendar: travel-sounding titles, or all-day events of 2+ days with a location. */
export function detectTrips(events: CalEvent[], today: string, withinDays = 60): Trip[] {
  const trips = new Map<string, Trip>();
  for (const e of events) {
    const [start, end] = eventDays(e);
    const days = daysBetween(start, end) + 1;
    const isTrip = !NOT_TRIP.test(e.title) && (TRIP_WORDS.test(e.title) || (e.allDay && days >= 2 && !!e.location));
    const until = daysBetween(today, start);
    if (!isTrip || until < 0 || until > withinDays) continue;
    const destination =
      e.location?.split(',')[0].trim() ||
      e.title
        .replace(TRIP_WORDS, '')
        .replace(/^[\s:–-]+|[\s:–-]+$/g, '')
        .replace(/^(to|in)\s+/i, '')
        .trim() ||
      e.title;
    const key = `${start}:${e.title}`;
    trips.set(key, { key, title: e.title, destination, start, end, nights: Math.max(0, days - 1), flight: FLIGHT_WORDS.test(e.title) });
  }
  return [...trips.values()].sort((a, b) => a.start.localeCompare(b.start));
}

export interface TripTask {
  id: string;
  label: string;
  /** Do it this many days before leaving */
  daysBefore: number;
}

export function tripChecklist(trip: Trip): TripTask[] {
  const list: TripTask[] = [
    ...(trip.flight
      ? [
          { id: 'passport', label: 'Check passport / ID is valid', daysBefore: 7 },
          { id: 'checkin', label: 'Online check-in & boarding pass', daysBefore: 1 },
          { id: 'airport', label: 'Plan how to get to the airport', daysBefore: 3 },
        ]
      : []),
    { id: 'laundry', label: 'Do laundry so you can pack clean clothes', daysBefore: 3 },
    { id: 'toiletries', label: 'Buy toiletries & travel-size products', daysBefore: 3 },
    { id: 'deliveries', label: 'Pause or move recurring deliveries', daysBefore: 3 },
    { id: 'nofresh', label: 'Don’t buy fresh milk or bread: it would expire while you’re away', daysBefore: 3 },
    { id: 'chargers', label: 'Pack chargers, adapters & headphones', daysBefore: 1 },
    { id: 'fridge', label: 'Empty the fridge of food that will spoil', daysBefore: 1 },
    { id: 'rubbish', label: 'Take the rubbish out', daysBefore: 0 },
  ];
  if (trip.nights >= 4) list.push({ id: 'plants', label: 'Water plants or ask a neighbour', daysBefore: 0 });
  return list.sort((a, b) => b.daysBefore - a.daysBefore);
}

/** Checklist items whose day has come and that aren't ticked yet. */
export function tripTasksNow(trip: Trip, checked: string[], today: string): TripTask[] {
  const until = daysBetween(today, trip.start);
  return tripChecklist(trip).filter((t) => !checked.includes(t.id) && until <= t.daysBefore);
}

// ---------- Morning briefing ----------

export interface BriefingInput {
  events: CalEvent[];
  todos: Todo[];
  admin: AdminItem[];
  people: Person[];
  tripChecks: Record<string, string[]>;
  dayStart: number;
  dayEnd: number;
}

export interface Briefing {
  date: string;
  events: CalEvent[];
  gaps: Gap[];
  todos: Todo[];
  admin: AdminItem[];
  birthdays: ReturnType<typeof upcomingBirthdays>;
  trips: { trip: Trip; daysUntil: number; tasks: TripTask[] }[];
  busyMinutes: number;
}

export function morningBriefing(input: BriefingInput, date: string, now?: Date): Briefing {
  const trips = detectTrips(input.events, date, 14).map((trip) => ({
    trip,
    daysUntil: daysBetween(date, trip.start),
    tasks: tripTasksNow(trip, input.tripChecks[trip.key] ?? [], date),
  }));
  return {
    date,
    events: eventsOn(input.events, date),
    gaps: freeGaps(input.events, date, input.dayStart, input.dayEnd, now),
    todos: todosDueBy(input.todos, date),
    admin: adminToRemind(input.admin, date),
    birthdays: upcomingBirthdays(input.people, date, 21).filter((b) => b.daysUntil <= b.person.remindDays),
    trips,
    busyMinutes: busyMinutes(input.events, date, input.dayStart, input.dayEnd),
  };
}

/** Short title + body for the morning notification. */
export function briefingText(b: Briefing): { title: string; body: string } {
  const timed = b.events.filter((e) => !e.allDay);
  const parts: string[] = [];
  if (timed.length) parts.push(`${timed.length} event${timed.length > 1 ? 's' : ''}, first ${time(timed[0].start)} ${timed[0].title}`);
  else parts.push('No meetings');
  if (b.todos.length) parts.push(`${b.todos.length} to-do${b.todos.length > 1 ? 's' : ''}`);
  if (b.admin.length) parts.push(`${b.admin[0].title}${b.admin.length > 1 ? ` +${b.admin.length - 1}` : ''}`);
  const bday = b.birthdays[0];
  if (bday) parts.push(bday.daysUntil === 0 ? `🎂 ${bday.person.name}'s birthday today!` : `🎂 ${bday.person.name} in ${bday.daysUntil} days`);
  const trip = b.trips[0];
  if (trip) parts.push(`🧳 ${trip.trip.destination} in ${trip.daysUntil} days`);
  const busy = b.busyMinutes >= 6 * 60 ? 'Busy day ahead' : b.busyMinutes >= 3 * 60 ? 'Steady day' : 'Light day';
  return { title: `☀️ ${busy}`, body: parts.join(' · ') };
}

// ---------- Reviews & planning ----------

export interface PeriodReview {
  from: string;
  to: string;
  events: number;
  busyHours: number;
  busiestDay?: { date: string; hours: number };
  todosDone: number;
  todosOpen: number;
  adminDone: number;
}

export function periodReview(
  events: CalEvent[],
  todos: Todo[],
  admin: AdminItem[],
  from: string,
  to: string,
  dayStart: number,
  dayEnd: number,
): PeriodReview {
  const days: string[] = [];
  for (let k = from; k <= to; k = addDays(k, 1)) days.push(k);
  const busy = days.map((d) => ({ date: d, hours: busyMinutes(events, d, dayStart, dayEnd) / 60 }));
  const inRange = (iso?: string) => !!iso && toDateKey(new Date(iso)) >= from && toDateKey(new Date(iso)) <= to;
  const ids = new Set(days.flatMap((d) => eventsOn(events, d).map((e) => e.id)));
  const busiest = [...busy].sort((a, b) => b.hours - a.hours)[0];
  return {
    from,
    to,
    events: ids.size,
    busyHours: Math.round(busy.reduce((h, d) => h + d.hours, 0) * 10) / 10,
    busiestDay: busiest && busiest.hours > 0 ? { date: busiest.date, hours: Math.round(busiest.hours * 10) / 10 } : undefined,
    todosDone: todos.filter((t) => inRange(t.done)).length,
    todosOpen: openTodos(todos).length,
    adminDone: admin.reduce((n, a) => n + a.history.filter(inRange).length, 0),
  };
}

export interface DayPlan {
  date: string;
  busyMinutes: number;
  freeMinutes: number;
  load: 'free' | 'moderate' | 'busy';
  events: CalEvent[];
  todos: Todo[];
  notes: string[];
}

/**
 * "Plan next week": how busy each day is, and open to-dos spread over the days with the most
 * free time (respecting due dates), plus birthdays, admin and trips that fall in the week.
 */
export function planWeek(input: BriefingInput, from: string): DayPlan[] {
  const days: DayPlan[] = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(from, i);
    const busy = busyMinutes(input.events, date, input.dayStart, input.dayEnd);
    const free = freeGaps(input.events, date, input.dayStart, input.dayEnd).reduce((m, g) => m + g.minutes, 0);
    return {
      date,
      busyMinutes: busy,
      freeMinutes: free,
      load: busy >= 6 * 60 ? 'busy' : busy >= 3 * 60 ? 'moderate' : 'free',
      events: eventsOn(input.events, date),
      todos: [],
      notes: [],
    };
  });
  const capacity = days.map((d) => d.freeMinutes);
  for (const todo of sortTodos(openTodos(input.todos))) {
    const need = todo.minutes ?? 15;
    // Days before its due date (or all days), choosing the one with the most free time left.
    const allowed = days.map((d, i) => i).filter((i) => !todo.due || days[i].date <= todo.due || todo.due < from);
    const pool = allowed.length ? allowed : [0];
    const best = pool.reduce((a, b) => (capacity[b] > capacity[a] ? b : a), pool[0]);
    if (capacity[best] < need) continue;
    capacity[best] -= need;
    days[best].todos.push(todo);
  }
  for (const d of days) {
    for (const b of upcomingBirthdays(input.people, d.date, 0)) d.notes.push(`🎂 ${b.person.name}'s birthday`);
    for (const a of input.admin) if (!a.done && a.due === d.date) d.notes.push(`📋 ${a.title}`);
    for (const t of detectTrips(input.events, d.date, 0)) d.notes.push(`🧳 Leave for ${t.destination}`);
  }
  return days;
}

export function weekSummaryLine(days: DayPlan[]): string {
  const busy = days.filter((d) => d.load === 'busy').map((d) => fromDateKey(d.date).toLocaleDateString(undefined, { weekday: 'long' }));
  const free = days.filter((d) => d.load === 'free').length;
  if (!busy.length) return `A calm week: ${free} light day${free === 1 ? '' : 's'}.`;
  return `Busiest: ${busy.join(', ')}. ${free} light day${free === 1 ? '' : 's'} for errands and chores.`;
}
