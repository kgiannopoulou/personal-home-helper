import { describe, expect, test } from '@jest/globals';
import type { AppState as ActivityState } from '../../src/modules/activity/lib/types';
import type { AppState as ChoresState } from '../../src/modules/chores/lib/types';
import type { AppState as FoodState } from '../../src/modules/food/lib/types';
import type { AppState as KitchenState } from '../../src/modules/kitchen/lib/types';
import type { AppState as MoneyState, Expense } from '../../src/modules/money/lib/types';
import type { AppState as ShoppingState } from '../../src/modules/shopping/lib/types';
import { historySummary, periods, type HistoryData } from '../../src/modules/assistant/lib/history';
import { lastNDays } from '../../src/shared/dates';

// Sunday 4 October 2026: the last 35 days are five whole Monday-to-Sunday weeks.
const now = new Date(2026, 9, 4, 12);
const keys = lastNDays(35, now);
const weekDays = (w: number) => keys.slice(w * 7, w * 7 + 7);

let id = 0;
const expense = (date: string, amount: number, category: Expense['category'], source: Expense['source'] = 'manual'): Expense => ({
  id: String(id++),
  date,
  amount,
  category,
  source,
});

function money(): MoneyState {
  const expenses: Expense[] = [expense('2026-09-01', 500, 'bills', 'recurring'), expense('2026-08-15', 100, 'eating_out')];
  for (let w = 0; w < 5; w++) {
    const d = weekDays(w);
    if (w % 2 === 0) expenses.push(expense(d[5], 80, 'groceries'), expense(d[2], 20, 'eating_out'));
    else expenses.push(expense(d[1], 15, 'groceries'), expense(d[3], 15, 'groceries'), expense(d[5], 15, 'groceries'), expense(d[4], 70, 'eating_out'));
  }
  return {
    expenses,
    recurring: [],
    rewards: [],
    appliances: [],
    settings: { monthlyBudget: 0, weeklyGroceries: 0, categoryBudgets: {}, currency: '€', kwhPrice: 0.2 },
  };
}

function activity(): ActivityState {
  const good = ['2026-09-07', '2026-09-09', '2026-09-11', '2026-09-13'];
  const short = ['2026-09-21', '2026-09-23', '2026-09-25', '2026-09-27'];
  const nights = [...good.map((date) => ({ date, hours: 8 })), ...short.map((date) => ({ date, hours: 6 }))];
  return {
    profile: { name: 'K', weightKg: 60, diet: 'omnivore', stepGoal: 8000, sleepGoalHours: 7 },
    workouts: [],
    sleep: nights.map((n, i) => ({ id: String(i), date: n.date, bedtime: '23:00', wake: '07:00', hours: n.hours, quality: n.hours > 7 ? 4 : 2 })),
    weights: [],
    steps: Object.fromEntries([...good.map((d) => [d, 10000]), ...short.map((d) => [d, 6000])]),
    coach: {
      level: 3,
      sessions: [
        ...good.map((date, i) => ({ id: `g${i}`, date, level: 3, completed: true, feeling: 'just_right' as const })),
        ...short.map((date, i) => ({ id: `s${i}`, date, level: 3, completed: true, feeling: 'hard' as const })),
      ],
    },
    schedule: { enabled: false, weekdays: [], time: '18:00', type: 'run' },
  };
}

function chores(): ChoresState {
  const at = (key: string) => new Date(`${key}T10:00:00`).toISOString();
  return {
    rooms: [{ id: 'r', name: 'Home', emoji: '🏠' }],
    tasks: [
      { id: 'vac', name: 'Vacuum', roomId: 'r', everyDays: 7, minutes: 20, lastDone: at('2026-09-02') },
      { id: 'dish', name: 'Dishes', roomId: 'r', everyDays: 1, minutes: 10, lastDone: at('2026-10-04') },
    ],
    completions: [
      { id: 'v', taskId: 'vac', at: at('2026-09-02'), minutes: 20 },
      ...keys.map((k) => ({ id: k, taskId: 'dish', at: at(k), minutes: 10 })),
    ],
    supplies: [],
    members: [],
    laundry: null,
    pinned: { date: '', taskIds: [] },
    settings: { dailyMinutes: [30, 30, 30, 30, 30, 30, 30], laundryMinutes: 90 },
  };
}

function food(): FoodState {
  return {
    profile: null,
    foods: [],
    water: keys.map((date, i) => ({ id: String(i), date, time: `${date}T12:00:00`, ml: [0, 6].includes(new Date(`${date}T12:00:00`).getDay()) ? 1500 : 2000, drink: 'water' as const })),
    reminders: { enabled: false, waterEveryHours: 2, wakeHour: 7, sleepHour: 23, meals: { breakfast: '08:00', lunch: '13:00', dinner: '19:00' } },
  };
}

const data = (): HistoryData => ({
  money: money(),
  food: food(),
  activity: activity(),
  chores: chores(),
  shopping: {
    items: [],
    trips: [0, 1, 2, 3, 4].map((w) => ({ id: String(w), date: weekDays(w)[5], total: 40 + w * 10, store: 'Lidl', itemCount: 10, source: 'manual' as const })),
    prices: {},
    history: { milk: { name: 'Milk', count: 9 } },
    settings: { weeklyBudget: 0, monthlyBudget: 0, currency: '€' },
  } as ShoppingState,
  kitchen: {
    items: [
      {
        id: 'm',
        name: 'Milk',
        category: 'dairy',
        location: 'fridge',
        level: 'full',
        boughtAt: '2026-10-03',
        purchases: ['2026-09-05', '2026-09-12', '2026-09-19', '2026-09-26', '2026-10-03'],
      },
    ],
    toBuy: [],
    settings: { autoAddLow: true, expiryReminders: true },
  } as unknown as KitchenState,
});

describe('periods', () => {
  test('a month window is split into Monday weeks, marking part weeks', () => {
    const ps = periods(lastNDays(28, now));
    expect(ps.map((p) => p.label)).toEqual(['week of 2026-09-07', 'week of 2026-09-14', 'week of 2026-09-21', 'week of 2026-09-28']);
    expect(periods(lastNDays(10, now))[0]).toMatchObject({ label: 'week of 2026-09-21 (part)', full: false });
  });

  test('long windows go by month', () => {
    expect(periods(lastNDays(200, now)).map((p) => p.label).slice(-2)).toEqual(['2026-09', '2026-10 (part)']);
  });
});

describe('history look-up', () => {
  test('money: per category, versus before, and weeks with vs without a big shop', () => {
    const text = historySummary('money', 35, data(), now);
    expect(text).toContain('Last 35 days, 2026-08-31 to 2026-10-04');
    expect(text).toContain('Spent €1030.00 in 15 expenses, about €206.00 a week.');
    expect(text).toContain('Bills €500.00 (€100.00)');
    expect(text).toContain('Versus the 35 days before (€100.00): +930%');
    expect(text).toContain('- week of 2026-09-07: €115.00');
    expect(text).toContain('[big shop €80.00]');
    expect(text).toContain('Big shop = one groceries expense of €40 or more. Full weeks with one (3)');
    expect(text).toContain('Weeks without a big shop cost +15% versus weeks with one');
    expect(text).toContain('small grocery top-ups €45.00 in 3 trips');
  });

  test('activity: sleep trend and how days go after good vs short nights', () => {
    const text = historySummary('activity', 35, data(), now);
    expect(text).toContain('Sleep: 7 h a night over 8 nights, quality 3/5, under 7 h on 4 nights. Earlier half 8 h → recent half 6 h.');
    expect(text).toContain('After 7+ h sleep: 4 nights, 10000 steps next day, runs felt good 4 of 4, 0 workouts. After less: 4 nights, 6000 steps next day, runs felt good 0 of 4');
    expect(text).toContain('Steps: 8000 a day on 8 tracked days, goal 8000 reached on 4 days.');
  });

  test('chores: what keeps slipping and what is on track', () => {
    const text = historySummary('chores', 35, data(), now);
    expect(text).toContain('- Vacuum (weekly): done 1× of ~5 expected, now 25 days overdue');
    expect(text).toContain('On track: Dishes.');
    expect(text).not.toContain('- Dishes');
  });

  test('food: water averages and weekdays vs weekends', () => {
    const text = historySummary('food', 35, data(), now);
    expect(text).toContain('Water: logged on 35 of 35 days, 1857 ml a day on those days.');
    expect(text).toContain('Weekdays vs weekends: 2000 vs 1500 ml water.');
    expect(text).toContain('Food: nothing logged.');
  });

  test('shopping: trips, usual day and how often items get bought', () => {
    const text = historySummary('shopping', 35, data(), now);
    expect(text).toContain('Shopping trips: 5 (about 1 a week, every ~7 days), €60 on average, biggest €80.00 on 2026-10-03 at Lidl.');
    expect(text).toContain('Usual days: Saturday (5).');
    expect(text).toContain('- Milk: 5×, every ~7 days, last 2026-10-03');
    expect(text).toContain('Added to the list most (all time): Milk (9).');
  });

  test('says so when nothing was logged', () => {
    const empty = data();
    empty.money.expenses = [];
    expect(historySummary('money', 28, empty, now)).toContain('No expenses logged in the last 28 days.');
  });
});
