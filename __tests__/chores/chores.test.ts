import { describe, expect, test } from '@jest/globals';
import {
  cleaningPlan,
  dueInfo,
  dueText,
  fairAssign,
  findSupply,
  laundryStatus,
  parseSupplyUpdate,
  planForTime,
  plannedWeeklyLoad,
  routineSuggestions,
  todayPlan,
  usualWeekday,
  weekWorkload,
} from '../../src/modules/chores/lib/chores';
import { defaultHome } from '../../src/modules/chores/lib/defaults';
import type { Completion, Room, Supply, Task } from '../../src/modules/chores/lib/types';

// Saturday 10 October 2026, 10:00
const now = new Date(2026, 9, 10, 10, 0);
const daysAgo = (n: number, hour = 9) => new Date(2026, 9, 10 - n, hour).toISOString();
const task = (name: string, everyDays: number, minutes: number, lastDoneDaysAgo?: number, patch: Partial<Task> = {}): Task => ({
  id: name,
  name,
  roomId: 'kitchen',
  everyDays,
  minutes,
  lastDone: lastDoneDaysAgo === undefined ? undefined : daysAgo(lastDoneDaysAgo),
  ...patch,
});

describe('due dates', () => {
  test('status and text', () => {
    expect(dueInfo(task('a', 7, 10, 9), now)).toEqual({ urgency: 9 / 7, dueIn: -2, status: 'overdue' });
    expect(dueInfo(task('a', 7, 10, 7), now).status).toBe('due');
    expect(dueInfo(task('a', 7, 10, 6), now).status).toBe('soon');
    expect(dueInfo(task('a', 7, 10, 2), now).status).toBe('ok');
    expect(dueText(task('a', 7, 10, 8), now)).toBe('1 day overdue');
    expect(dueText(task('a', 7, 10, 6), now)).toBe('Due tomorrow');
    expect(dueText(task('a', 7, 10), now)).toBe('Not done yet');
  });

  test('counts calendar days, not 24-hour periods', () => {
    const lateLastNight = new Date(2026, 9, 9, 23, 30).toISOString();
    expect(dueInfo(task('Dishes', 1, 15, undefined, { lastDone: lateLastNight }), now).status).toBe('due');
  });
});

describe('planning', () => {
  const tasks = [
    task('Vacuum', 7, 20, 10),
    task('Bathroom', 7, 15, 8),
    task('Rubbish', 3, 2, 3),
    task('Counters', 1, 3, 1),
    task('Windows', 30, 30, 5),
    task('Dishes done', 1, 15, 0),
  ];

  test('"I have 10 minutes" fits the most urgent short tasks', () => {
    const plan = planForTime(tasks, 10, now);
    expect(plan.tasks.map((t) => t.name)).toEqual(['Rubbish', 'Counters']);
    expect(plan.minutes).toBe(5);
  });

  test('"I have 30 minutes" starts with the most overdue', () => {
    expect(planForTime(tasks, 30, now).tasks.map((t) => t.name)).toEqual(['Vacuum', 'Rubbish', 'Counters']);
  });

  test("today's plan keeps pinned tasks and respects a busy day", () => {
    const busy = todayPlan(tasks, ['Windows'], 40, now);
    expect(busy.tasks.map((t) => t.name)).toEqual(['Windows', 'Rubbish', 'Counters']);
    expect(busy.minutes).toBe(35);
    expect(busy.postponed).toBe(2);
    expect(todayPlan(tasks, [], 120, now).postponed).toBe(0);
  });

  test('cleaning mode groups by room and skips personal routines', () => {
    const rooms: Room[] = [
      { id: 'kitchen', name: 'Kitchen', emoji: '🍳' },
      { id: 'bath', name: 'Bathroom', emoji: '🚿' },
      { id: 'me', name: 'Me', emoji: '🧴', personal: true },
    ];
    const t = [
      task('Clean kitchen', 7, 20, 6),
      task('Clean toilet', 7, 10, 9, { roomId: 'bath' }),
      task('Clean shower', 7, 15, 9, { roomId: 'bath' }),
      task('Skincare', 1, 10, 1, { roomId: 'me' }),
      task('Oven', 30, 30, 3),
    ];
    const plan = cleaningPlan(t, rooms, 45, now);
    expect(plan.map((g) => [g.room.name, g.tasks.map((x) => x.name), g.minutes])).toEqual([
      ['Kitchen', ['Clean kitchen'], 20],
      ['Bathroom', ['Clean toilet', 'Clean shower'], 25],
    ]);
  });
});

describe('learning routines', () => {
  const c = (taskId: string, at: Date): Completion => ({ id: at.toISOString(), taskId, at: at.toISOString(), minutes: 10 });
  // Three Saturdays and one Sunday
  const history = [
    c('Bathroom', new Date(2026, 8, 19, 11)),
    c('Bathroom', new Date(2026, 8, 26, 11)),
    c('Bathroom', new Date(2026, 8, 27, 11)),
    c('Bathroom', new Date(2026, 9, 3, 11)),
  ];

  test('finds the usual weekday', () => {
    expect(usualWeekday('Bathroom', history)).toBe(6);
    expect(usualWeekday('Bathroom', history.slice(0, 2))).toBeNull();
  });

  test('suggests it on that day when it is nearly due', () => {
    const tasks = [task('Bathroom', 7, 15, 7)];
    expect(routineSuggestions(tasks, history, [], now).map((t) => t.name)).toEqual(['Bathroom']);
    expect(routineSuggestions(tasks, history, ['Bathroom'], now)).toEqual([]);
    expect(routineSuggestions(tasks, history, [], new Date(2026, 9, 11, 10))).toEqual([]);
  });
});

describe('household', () => {
  const members = [
    { id: 'alex', name: 'Alex' },
    { id: 'maria', name: 'Maria' },
  ];

  test('workload counts minutes since Monday', () => {
    const completions: Completion[] = [
      { id: '1', taskId: 'x', at: daysAgo(1), by: 'alex', minutes: 20 },
      { id: '2', taskId: 'x', at: daysAgo(4), by: 'alex', minutes: 10 },
      { id: '3', taskId: 'x', at: daysAgo(6), by: 'maria', minutes: 30 }, // last Sunday
      { id: '4', taskId: 'x', at: daysAgo(0), by: 'maria', minutes: 5 },
    ];
    expect(weekWorkload(completions, members, now).map((w) => w.minutes)).toEqual([30, 5]);
  });

  test('fair share balances minutes, not chore count', () => {
    const tasks = [task('Bathroom', 7, 30), task('Vacuum', 7, 20), task('Rubbish', 7, 5), task('Mirror', 7, 5), task('Bed', 7, 5)];
    const assignment = fairAssign(tasks, members);
    const assigned = tasks.map((t) => ({ ...t, assignee: assignment[t.id] }));
    expect(plannedWeeklyLoad(assigned, members).map((p) => p.minutes)).toEqual([35, 30]);
    expect(assignment.Bathroom).toBe('alex');
    expect(fairAssign(tasks, [])).toEqual({});
  });
});

describe('supplies', () => {
  test('understands what you used up or bought', () => {
    expect(parseSupplyUpdate('I finished the dish soap')).toEqual({ name: 'Dish soap', level: 'out' });
    expect(parseSupplyUpdate("We're out of sponges!")).toEqual({ name: 'Sponges', level: 'out' });
    expect(parseSupplyUpdate('Laundry detergent is running low')).toEqual({ name: 'Laundry detergent', level: 'low' });
    expect(parseSupplyUpdate('the toilet paper is almost empty')).toEqual({ name: 'Toilet paper', level: 'low' });
    expect(parseSupplyUpdate('bought trash bags')).toEqual({ name: 'Trash bags', level: 'full' });
    expect(parseSupplyUpdate('hello')).toBeNull();
  });

  test('matches supplies loosely', () => {
    const supplies: Supply[] = [
      { id: '1', name: 'Dish soap', category: 'cleaning', level: 'full' },
      { id: '2', name: 'Laundry detergent', category: 'cleaning', level: 'full' },
    ];
    expect(findSupply(supplies, 'dish soaps')?.id).toBe('1');
    expect(findSupply(supplies, 'detergent')?.id).toBe('2');
    expect(findSupply(supplies, 'bleach')).toBeUndefined();
  });

  test('default home is sorted into shopping categories', () => {
    const { supplies, rooms, tasks } = defaultHome();
    expect(supplies.find((s) => s.name === 'Dish soap')?.category).toBe('cleaning');
    expect(supplies.find((s) => s.name === 'Toilet paper')?.category).toBe('bathroom');
    expect(supplies.find((s) => s.name === 'Trash bags')?.category).toBe('home');
    expect(rooms.filter((r) => r.personal).map((r) => r.name)).toEqual(['Me']);
    expect(tasks.every((t) => rooms.some((r) => r.id === t.roomId))).toBe(true);
  });
});

describe('laundry', () => {
  test('countdown', () => {
    const load = { type: 'whites' as const, startedAt: new Date(2026, 9, 10, 9, 0).toISOString(), minutes: 90 };
    expect(laundryStatus(load, now)).toMatchObject({ ready: false, minutesLeft: 30 });
    expect(laundryStatus(load, new Date(2026, 9, 10, 10, 31)).ready).toBe(true);
  });
});
