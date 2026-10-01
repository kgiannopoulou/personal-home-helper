import { describe, expect, test } from '@jest/globals';
import {
  addMonths,
  adminToRemind,
  birthdaysFromEvents,
  briefingText,
  busyMinutes,
  completeAdmin,
  detectTrips,
  eventDays,
  eventsOn,
  fitTodos,
  freeGaps,
  morningBriefing,
  nextBirthday,
  periodReview,
  planWeek,
  quickGiftIdeas,
  tripChecklist,
  tripTasksNow,
  type BriefingInput,
} from '../../src/modules/planner/lib/planner';
import type { AdminItem, CalEvent, Person, Todo } from '../../src/modules/planner/lib/types';

// Thursday 15 October 2026
const TODAY = '2026-10-15';
const at = (day: number, h: number, m = 0) => new Date(2026, 9, day, h, m).toISOString();
const ev = (title: string, start: string, end: string, patch: Partial<CalEvent> = {}): CalEvent => ({
  id: title + start,
  title,
  start,
  end,
  allDay: false,
  source: 'manual',
  ...patch,
});
const allDay = (title: string, fromDay: number, toDay: number, patch: Partial<CalEvent> = {}) =>
  ev(title, new Date(2026, 9, fromDay).toISOString(), new Date(2026, 9, toDay + 1).toISOString(), { allDay: true, ...patch });
const todo = (title: string, patch: Partial<Todo> = {}): Todo => ({ id: title, title, createdAt: '2026-10-01T00:00:00Z', ...patch });
const admin = (title: string, due: string, patch: Partial<AdminItem> = {}): AdminItem => ({
  id: title,
  title,
  kind: 'bill',
  due,
  repeatMonths: 1,
  remindDays: 3,
  history: [],
  ...patch,
});
const person = (name: string, birthday: string, patch: Partial<Person> = {}): Person => ({
  id: name,
  name,
  birthday,
  interests: '',
  ideas: [],
  remindDays: 21,
  ...patch,
});

const day = [
  ev('Work', at(15, 9), at(15, 13)),
  ev('Standup overlap', at(15, 12), at(15, 13, 30)),
  ev('Gym', at(15, 18), at(15, 19)),
  allDay('Bank holiday', 15, 15),
];

describe('calendar', () => {
  test('events of a day, all-day first', () => {
    expect(eventsOn(day, TODAY).map((e) => e.title)).toEqual(['Bank holiday', 'Work', 'Standup overlap', 'Gym']);
    expect(eventsOn(day, '2026-10-16')).toEqual([]);
  });

  test('busy time merges overlapping events', () => {
    expect(busyMinutes(day, TODAY, 7, 22)).toBe(4.5 * 60 + 60);
  });

  test('free gaps in waking hours, and only what is left today', () => {
    const gaps = freeGaps(day, TODAY, 7, 22).map((g) => [g.start.getHours(), g.end.getHours(), g.minutes]);
    expect(gaps).toEqual([
      [7, 9, 120],
      [13, 18, 270],
      [19, 22, 180],
    ]);
    const later = freeGaps(day, TODAY, 7, 22, new Date(2026, 9, 15, 14, 2));
    expect(later[0].start.getMinutes()).toBe(5);
    expect(later.map((g) => g.minutes)).toEqual([235, 180]);
  });

  test('all-day event days', () => {
    expect(eventDays(allDay('Trip', 20, 23))).toEqual(['2026-10-20', '2026-10-23']);
    expect(eventDays(ev('Late', at(15, 20), new Date(2026, 9, 16).toISOString()))).toEqual([TODAY, TODAY]);
  });
});

describe('to-dos', () => {
  test('fit into free gaps, most urgent first', () => {
    const gaps = freeGaps(day, TODAY, 7, 22);
    const fits = fitTodos(
      [todo('Call bank', { due: '2026-10-14', minutes: 150 }), todo('Post office', { due: TODAY, minutes: 30 }), todo('Read', { done: 'x' })],
      gaps,
    );
    expect(fits.map((f) => [f.todo.title, f.gap.start.getHours()])).toEqual([
      ['Call bank', 13],
      ['Post office', 7],
    ]);
  });
});

describe('life admin', () => {
  test('reminds inside the window, overdue included', () => {
    const items = [admin('Rent', '2026-10-17'), admin('Insurance', '2026-11-20', { remindDays: 30 }), admin('Phone', '2026-10-10'), admin('Gym', '2026-10-25')];
    expect(adminToRemind(items, TODAY).map((a) => a.title)).toEqual(['Phone', 'Rent']);
  });

  test('completing moves repeating items to the next future date', () => {
    const now = new Date(2026, 9, 15, 10);
    expect(completeAdmin(admin('Rent', '2026-10-01'), now).due).toBe('2026-11-01');
    expect(completeAdmin(admin('Dentist', '2026-03-10', { repeatMonths: 6 }), now).due).toBe('2027-03-10');
    const once = completeAdmin(admin('Passport', '2026-10-20', { repeatMonths: 0 }), now);
    expect(once.done).toBe(true);
    expect(once.history).toHaveLength(1);
  });

  test('month maths keeps end-of-month dates valid', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-15');
  });
});

describe('birthdays', () => {
  test('next birthday and age', () => {
    expect(nextBirthday(person('Mom', '10-20', { year: 1965 }), TODAY)).toEqual({ date: '2026-10-20', daysUntil: 5, turning: 61 });
    expect(nextBirthday(person('Alex', '03-02'), TODAY)).toMatchObject({ date: '2027-03-02', turning: undefined });
    expect(nextBirthday(person('Leap', '02-29'), TODAY).date).toBe('2027-02-28');
  });

  test('found in calendar titles', () => {
    const events = [allDay("Mom's birthday 🎂", 20, 20), allDay('Birthday: Alex', 22, 22), allDay('Maria bday', 30, 30), ev('Dentist', at(16, 9), at(16, 10))];
    expect(birthdaysFromEvents(events)).toEqual([
      { name: 'Mom', birthday: '10-20' },
      { name: 'Alex', birthday: '10-22' },
      { name: 'Maria', birthday: '10-30' },
    ]);
  });

  test('offline gift ideas follow interests', () => {
    const ideas = quickGiftIdeas('She likes cooking and gardening');
    expect(ideas).toContain('A herb-growing kit');
    expect(ideas.some((i) => i.toLowerCase().includes('cookbook'))).toBe(true);
    expect(quickGiftIdeas('')).toHaveLength(3);
  });
});

describe('trips', () => {
  const events = [
    allDay('✈️ London', 20, 24),
    allDay('Conference', 27, 28, { location: 'Lisbon, Portugal' }),
    ev('Trip to Toronto', at(30, 8), at(30, 20)),
    allDay('Holiday', 1, 2),
    allDay('Bank holiday', 26, 26),
    ev('Work', at(16, 9), at(16, 17)),
  ];

  test('detects upcoming trips', () => {
    const trips = detectTrips(events, TODAY);
    expect(trips.map((t) => [t.destination, t.start, t.nights, t.flight])).toEqual([
      ['London', '2026-10-20', 4, true],
      ['Lisbon', '2026-10-27', 1, false],
      ['Toronto', '2026-10-30', 0, false],
    ]);
  });

  test('checklist items appear on their day', () => {
    const [london] = detectTrips(events, TODAY);
    expect(tripChecklist(london).map((t) => t.id)).toContain('passport');
    expect(tripChecklist(london).map((t) => t.id)).toContain('plants');
    // 5 days before: only the passport check is due
    expect(tripTasksNow(london, [], TODAY).map((t) => t.id)).toEqual(['passport']);
    expect(tripTasksNow(london, ['passport'], '2026-10-17').map((t) => t.id)).toEqual(['airport', 'laundry', 'toiletries', 'deliveries', 'nofresh']);
  });
});

describe('briefing, reviews and planning', () => {
  const input: BriefingInput = {
    events: [...day, allDay('✈️ London', 20, 24)],
    todos: [todo('Post office', { due: TODAY, minutes: 30 }), todo('Taxes', { due: '2026-10-21', minutes: 120 }), todo('Clean garage', { minutes: 60 })],
    admin: [admin('Rent', '2026-10-17')],
    people: [person('Mom', '10-20')],
    tripChecks: {},
    dayStart: 7,
    dayEnd: 22,
  };

  test('morning briefing brings it all together', () => {
    const b = morningBriefing(input, TODAY);
    expect(b.events).toHaveLength(4);
    expect(b.todos.map((t) => t.title)).toEqual(['Post office']);
    expect(b.admin.map((a) => a.title)).toEqual(['Rent']);
    expect(b.birthdays.map((x) => x.person.name)).toEqual(['Mom']);
    expect(b.trips[0].daysUntil).toBe(5);
    const text = briefingText(b);
    expect(text.title).toBe('☀️ Steady day');
    expect(text.body).toContain('3 events, first');
    expect(text.body).toContain('🎂 Mom in 5 days');
    expect(text.body).toContain('🧳 London in 5 days');
  });

  test('week review counts events, busy hours and done items', () => {
    const r = periodReview(
      input.events,
      [todo('a', { done: at(13, 10) }), todo('b', { done: at(2, 10) }), todo('c')],
      [admin('Rent', '2026-11-01', { history: [at(14, 9)] })],
      '2026-10-12',
      '2026-10-18',
      7,
      22,
    );
    expect(r).toMatchObject({ events: 4, busyHours: 5.5, todosDone: 1, todosOpen: 1, adminDone: 1 });
    expect(r.busiestDay?.date).toBe(TODAY);
  });

  test('plan next week puts to-dos on free days before they are due', () => {
    const busyMonday = ev('Workshop', at(19, 8), at(19, 21));
    const days = planWeek({ ...input, events: [...input.events, busyMonday] }, '2026-10-19');
    expect(days[0].load).toBe('busy');
    const placed = Object.fromEntries(days.flatMap((d) => d.todos.map((t) => [t.title, d.date])));
    expect(placed['Taxes'] <= '2026-10-21').toBe(true);
    expect(placed['Taxes']).not.toBe('2026-10-19');
    expect(days[1].notes).toContain("🎂 Mom's birthday");
    expect(days[1].notes).toContain('🧳 Leave for London');
  });
});
