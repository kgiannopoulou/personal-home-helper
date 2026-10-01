import { describe, expect, test } from '@jest/globals';
import {
  applianceCost,
  applyRecurring,
  guessCategory,
  insights,
  monthHistory,
  monthSummary,
  parseExpense,
  shiftMonth,
  suggestReward,
} from '../../src/modules/money/lib/budget';
import { parseMoneyImport } from '../../src/modules/money/lib/links';
import type { AppState, Expense, ExpenseCategory, Settings } from '../../src/modules/money/lib/types';

const exp = (date: string, amount: number, category: ExpenseCategory = 'groceries', patch: Partial<Expense> = {}): Expense => ({
  id: date + amount + category,
  date,
  amount,
  category,
  source: 'manual',
  ...patch,
});
const settings = (patch: Partial<Settings> = {}): Settings => ({
  monthlyBudget: 0,
  weeklyGroceries: 0,
  categoryBudgets: {},
  currency: '€',
  kwhPrice: 0.25,
  ...patch,
});

describe('quick add', () => {
  test('parses amount, note and category', () => {
    expect(parseExpense('12.50 lunch')).toEqual({ amount: 12.5, note: 'Lunch', category: 'eating_out' });
    expect(parseExpense('Lidl 23,40')).toEqual({ amount: 23.4, note: 'Lidl', category: 'groceries' });
    expect(parseExpense('€30 petrol')).toEqual({ amount: 30, note: 'Petrol', category: 'transport' });
    expect(parseExpense('cinema 9€')).toEqual({ amount: 9, note: 'Cinema', category: 'fun' });
  });

  test('picks the money amount, not a count', () => {
    expect(parseExpense('2 coffees 7.50')).toEqual({ amount: 7.5, note: '2 coffees', category: 'eating_out' });
  });

  test('rejects text without an amount', () => {
    expect(parseExpense('lunch')).toBeNull();
    expect(parseExpense('0 lunch')).toBeNull();
  });

  test('guesses categories by whole word', () => {
    expect(guessCategory('Netflix')).toBe('bills');
    expect(guessCategory('bus ticket')).toBe('transport');
    expect(guessCategory('business lunch')).toBe('eating_out');
    expect(guessCategory('something')).toBe('other');
  });
});

describe('month summary', () => {
  const today = new Date(2026, 9, 10); // 10 Oct 2026

  test('totals, pace compared with the same point in earlier months, and projection', () => {
    const expenses = [
      exp('2026-10-01', 600, 'bills', { source: 'recurring' }),
      exp('2026-10-05', 100),
      exp('2026-10-09', 100, 'eating_out'),
      // September: 500 by the 10th, 900 in total
      exp('2026-09-03', 500),
      exp('2026-09-20', 400),
      // August: 700 by the 10th, 1100 in total
      exp('2026-08-02', 700),
      exp('2026-08-25', 400),
    ];
    const s = monthSummary(expenses, settings({ monthlyBudget: 1200 }), today);
    expect(s.total).toBe(800);
    expect(s.byCategory.groceries).toBe(100);
    expect(s.usualByNow).toBe(600);
    expect(s.averageMonth).toBe(1000);
    expect(s.lastMonth).toBe(900);
    // Rent counted once, the 200 of day-to-day spending extrapolated over 31 days
    expect(s.projected).toBe(1220);
    expect(s.remaining).toBe(400);
    expect(s.daysLeft).toBe(22);
    expect(s.perDay).toBe(18.18);
  });

  test('without history or budget there is nothing to compare', () => {
    const s = monthSummary([exp('2026-10-02', 20)], settings(), today);
    expect(s.usualByNow).toBeNull();
    expect(s.remaining).toBeNull();
    expect(s.perDay).toBeNull();
  });

  test('groceries this week starts on Monday', () => {
    const s = monthSummary(
      [exp('2026-10-04', 50), exp('2026-10-05', 30), exp('2026-10-08', 10, 'household'), exp('2026-10-09', 99, 'fun')],
      settings(),
      today,
    );
    expect(s.groceriesThisWeek).toBe(40);
  });

  test('insights mention pace, budget and category limits', () => {
    const expenses = [exp('2026-10-05', 300, 'eating_out'), exp('2026-09-05', 100)];
    const st = settings({ monthlyBudget: 500, categoryBudgets: { eating_out: 200 } });
    const tips = insights(monthSummary(expenses, st, today), st, [], today);
    expect(tips[0]).toBe('📈 You\'ve spent €200.00 more than usual by this point in the month.');
    expect(tips.some((t) => t.startsWith('🔮 At this pace'))).toBe(true);
    expect(tips).toContain('🍽️ Eating out: €300.00 of €200.00, €100.00 over.');
  });
});

describe('rewards', () => {
  test('suggests the best reward the savings can buy', () => {
    const st = settings({ monthlyBudget: 1000 });
    const s = monthSummary([exp('2026-09-10', 950)], st, new Date(2026, 9, 3));
    const rewards = [
      { id: '1', name: 'a new book', price: 15 },
      { id: '2', name: 'concert tickets', price: 80 },
      { id: '3', name: 'a plant', price: 40 },
    ];
    expect(suggestReward(s, st, rewards)).toBe('🎁 You spent €50.00 less than your budget last month. Treat yourself to a plant (€40.00)!');
  });

  test('no reward when over budget or without a budget', () => {
    const rewards = [{ id: '1', name: 'a book', price: 10 }];
    const over = settings({ monthlyBudget: 500 });
    expect(suggestReward(monthSummary([exp('2026-09-10', 600)], over, new Date(2026, 9, 3)), over, rewards)).toBeNull();
    expect(suggestReward(monthSummary([exp('2026-09-10', 100)], settings(), new Date(2026, 9, 3)), settings(), rewards)).toBeNull();
  });
});

describe('recurring bills', () => {
  const state: AppState = {
    expenses: [],
    rewards: [],
    appliances: [],
    settings: settings(),
    recurring: [
      { id: 'rent', name: 'Rent', amount: 600, category: 'bills', dayOfMonth: 1 },
      { id: 'gym', name: 'Gym', amount: 30, category: 'bills', dayOfMonth: 15 },
    ],
  };

  test('adds bills whose day has come, once per month', () => {
    const once = applyRecurring(state, new Date(2026, 9, 10));
    expect(once.expenses.map((e) => [e.note, e.date])).toEqual([['Rent', '2026-10-01']]);
    const twice = applyRecurring(once, new Date(2026, 9, 20));
    expect(twice.expenses.map((e) => e.note)).toEqual(['Rent', 'Gym']);
    expect(applyRecurring(twice, new Date(2026, 9, 25))).toBe(twice);
    expect(applyRecurring(twice, new Date(2026, 10, 1)).expenses.length).toBe(3);
  });
});

describe('energy', () => {
  test('heater running cost', () => {
    expect(applianceCost({ kw: 2, hoursPerDay: 4, daysPerMonth: 30 }, 0.25)).toEqual({
      kwhPerMonth: 240,
      perDay: 2,
      perMonth: 60,
      oneHourLess: 15,
    });
  });
});

describe('helpers', () => {
  test('month maths', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(monthHistory([exp('2026-09-01', 10), exp('2026-10-01', 5)], 3, new Date(2026, 9, 5))).toEqual([
      { month: '2026-08', total: 0 },
      { month: '2026-09', total: 10 },
      { month: '2026-10', total: 5 },
    ]);
  });

  test('import link', () => {
    expect(parseMoneyImport({ spend: '23.40', store: 'Lidl', date: '2026-10-01' })).toEqual({
      amount: 23.4,
      store: 'Lidl',
      date: '2026-10-01',
      category: 'groceries',
    });
    expect(parseMoneyImport({ spend: '5', category: 'household' })?.category).toBe('household');
    expect(parseMoneyImport({ spend: '5', category: 'nonsense' })?.category).toBe('groceries');
    expect(parseMoneyImport({ items: 'Milk' })).toBeNull();
  });
});
