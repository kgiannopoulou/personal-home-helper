import { describe, expect, test } from '@jest/globals';
import type { Completion, Task } from '../../src/modules/chores/lib/types';
import type { InventoryItem } from '../../src/modules/kitchen/lib/types';
import type { Expense, Settings } from '../../src/modules/money/lib/types';
import { budgetForecast, itemsForShoppingDay, learnFrequency, shoppingDates, usualShoppingDay, wholeMoney } from '../../src/shared/predictions';

describe('shopping day', () => {
  // Saturdays in September 2026, plus one Wednesday top-up.
  const dates = ['2026-09-05', '2026-09-12', '2026-09-16', '2026-09-19', '2026-09-26'];

  test('learns the usual weekday and the next one from today', () => {
    expect(usualShoppingDay(dates, '2026-09-30')).toEqual({ weekday: 6, name: 'Saturday', next: '2026-10-03', share: 0.8 });
    expect(usualShoppingDay(dates, '2026-10-03')?.next).toBe('2026-10-03'); // today is shopping day
  });

  test('needs a real pattern', () => {
    expect(usualShoppingDay(dates.slice(0, 2), '2026-09-30')).toBeNull();
    expect(usualShoppingDay(['2026-09-14', '2026-09-16', '2026-09-18', '2026-09-20'], '2026-09-30')).toBeNull();
  });

  test('shops come from trips and real grocery spends', () => {
    const e = (date: string, amount: number, category: Expense['category'] = 'groceries'): Expense => ({ id: date, date, amount, category, source: 'manual' });
    expect(shoppingDates([{ date: '2026-09-05' }], [e('2026-09-05', 60), e('2026-09-12', 45), e('2026-09-13', 4), e('2026-09-14', 30, 'fun')])).toEqual([
      '2026-09-05',
      '2026-09-12',
    ]);
  });

  test('the list gets what is low and what runs out before the next shop', () => {
    const item = (name: string, level: InventoryItem['level'], purchases: string[] = []): InventoryItem => ({
      id: name,
      name,
      category: 'food',
      location: 'fridge',
      level,
      boughtAt: purchases[purchases.length - 1] ?? '2026-09-01',
      purchases,
    });
    const kitchen = [
      item('Eggs', 'low'),
      // Bought every 5 days, last on the 1st: runs out on the 6th, before the shop after Saturday the 3rd.
      item('Milk', 'full', ['2026-09-21', '2026-09-26', '2026-10-01']),
      // Bought every 30 days: still fine.
      item('Rice', 'full', ['2026-07-27', '2026-08-26', '2026-09-25']),
      item('Butter', 'empty'),
    ];
    const supplies = [{ id: 's', name: 'Dish soap', category: 'cleaning' as const, level: 'out' as const }];
    expect(itemsForShoppingDay(kitchen, supplies, ['butter'], '2026-10-03', '2026-10-02')).toEqual([
      { name: 'Eggs', why: 'low' },
      { name: 'Milk', why: 'runs out around 2026-10-06' },
      { name: 'Dish soap', why: 'empty' },
    ]);
  });
});

describe('budget forecast', () => {
  const settings: Settings = { monthlyBudget: 1000, weeklyGroceries: 0, categoryBudgets: {}, currency: '€', kwhPrice: 0.2 };
  const e = (date: string, amount: number): Expense => ({ id: date + amount, date, amount, category: 'groceries', source: 'manual' });

  test('mid-month without history: the pace', () => {
    const f = budgetForecast([e('2026-09-05', 300), e('2026-09-14', 290)], settings, new Date(2026, 8, 15));
    expect(f).toEqual({ forecast: 1180, budget: 1000, over: 180, text: 'At this pace: €1,180 of €1,000' });
  });

  test('early in the month it leans on how past months went', () => {
    // Past months: €200 by the 3rd, €900 in all. This month €300 by the 3rd.
    const past = ['2026-07', '2026-08'].flatMap((m) => [e(`${m}-02`, 200), e(`${m}-20`, 700)]);
    const f = budgetForecast([...past, e('2026-09-02', 300)], settings, new Date(2026, 8, 3))!;
    // History says 300 × 900/200 = 1350; the pace says 300/3 × 30 = 3000; on day 3 of 30 it's 10% pace.
    expect(f.forecast).toBe(1515);
  });

  test('too early with no history, or nothing spent: no forecast', () => {
    expect(budgetForecast([e('2026-09-02', 50)], settings, new Date(2026, 8, 3))).toBeNull();
    expect(budgetForecast([], settings, new Date(2026, 8, 20))).toBeNull();
  });

  test('without a budget it still says where the month will end', () => {
    expect(budgetForecast([e('2026-09-05', 600)], { ...settings, monthlyBudget: 0 }, new Date(2026, 8, 15))?.text).toBe('At this pace: about €1,200 this month');
    expect(wholeMoney(1234567.4, '€')).toBe('€1,234,567');
  });
});

describe('chore frequencies that learn', () => {
  const task = (everyDays: number, extra: Partial<Task> = {}): Task => ({ id: 't', name: 'Vacuum', roomId: 'r', everyDays, minutes: 20, ...extra });
  const done = (...days: string[]): Completion[] => days.map((d) => ({ id: d, taskId: 't', at: new Date(`${d}T10:00:00`).toISOString(), minutes: 20 }));
  const now = new Date(2026, 9, 3, 12);

  test('kept skipping a weekly chore: every 2 weeks', () => {
    expect(learnFrequency(task(7), done('2026-08-20', '2026-09-01', '2026-09-13', '2026-09-26'), now)).toEqual({ everyDays: 14, why: 'late', typical: 12 });
  });

  test('a long overdue stretch now counts too', () => {
    expect(learnFrequency(task(7), done('2026-08-25', '2026-09-06', '2026-09-18'), now)?.everyDays).toBe(14);
  });

  test('always done early: more often', () => {
    expect(learnFrequency(task(14), done('2026-09-02', '2026-09-09', '2026-09-17', '2026-09-24', '2026-10-01'), now)).toEqual({ everyDays: 7, why: 'early', typical: 7 });
  });

  test('a mixed or short record changes nothing', () => {
    expect(learnFrequency(task(7), done('2026-09-05', '2026-09-17', '2026-09-24', '2026-10-01'), now)).toBeNull();
    expect(learnFrequency(task(7), done('2026-09-10', '2026-09-24'), now)).toBeNull();
  });

  test('not again right after a change, and never after you undid one', () => {
    const history = done('2026-08-20', '2026-09-01', '2026-09-13', '2026-09-26');
    expect(learnFrequency(task(7, { learned: { from: 3, on: '2026-09-25' } }), history, now)).toBeNull();
    expect(learnFrequency(task(7, { fixedFrequency: true }), history, now)).toBeNull();
  });
});
