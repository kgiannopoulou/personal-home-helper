import { describe, expect, test } from '@jest/globals';
import { categorize } from '../../src/shared/homeCore';
import {
  estimateList,
  estimatePrice,
  groupByCategory,
  parseItems,
  quickAdds,
  spendingInsights,
  spendSummary,
  typicalPrice,
  weekStart,
} from '../../src/modules/shopping/lib/shopping';
import type { ListItem, Trip } from '../../src/modules/shopping/lib/types';

const item = (name: string, patch: Partial<ListItem> = {}): ListItem => ({
  id: name,
  name,
  category: categorize(name),
  checked: false,
  addedAt: '',
  source: 'manual',
  ...patch,
});
const trip = (date: string, total: number): Trip => ({ id: date + total, date, total, itemCount: 1, source: 'manual' });

describe('list', () => {
  test('parses typed items with quantities', () => {
    expect(parseItems('milk, 2 x eggs and dish soap')).toEqual([
      { name: 'Milk' },
      { name: 'Eggs', quantity: '2 x' },
      { name: 'Dish soap' },
    ]);
    expect(parseItems('1 kg rice; 6 pack water')).toEqual([
      { name: 'Rice', quantity: '1 kg' },
      { name: 'Water', quantity: '6 pack' },
    ]);
  });

  test('groups by category in store order, unchecked first', () => {
    const groups = groupByCategory([item('Sponges'), item('Milk', { checked: true }), item('Bananas'), item('Shampoo')]);
    expect(groups.map((g) => g.category)).toEqual(['food', 'cleaning', 'bathroom']);
    expect(groups[0].items.map((i) => i.name)).toEqual(['Bananas', 'Milk']);
  });

  test('price: own > last paid > typical', () => {
    expect(typicalPrice('Semi-skimmed milk')).toBe(1.2);
    expect(estimatePrice({ name: 'Milk' }, {})).toBe(1.2);
    expect(estimatePrice({ name: 'Milk' }, { milk: 0.99 })).toBe(0.99);
    expect(estimatePrice({ name: 'Milk', price: 1.5 }, { milk: 0.99 })).toBe(1.5);
    expect(estimatePrice({ name: 'Saffron' }, {})).toBeUndefined();
  });

  test('estimates unchecked items only', () => {
    const est = estimateList([item('Milk'), item('Eggs'), item('Saffron'), item('Bread', { checked: true })], {});
    expect(est).toEqual({ total: 3.7, unknown: 1 });
  });

  test('suggests frequent items not on the list', () => {
    const history = { milk: { name: 'Milk', count: 5 }, egg: { name: 'Eggs', count: 3 }, tofu: { name: 'Tofu', count: 1 } };
    expect(quickAdds(history, [item('Milk')])).toEqual(['Eggs']);
  });
});

describe('spending', () => {
  const today = '2026-09-30'; // a Wednesday

  test('weeks start on Monday', () => {
    expect(weekStart(today)).toBe('2026-09-28');
    expect(weekStart('2026-09-27')).toBe('2026-09-21'); // Sunday
  });

  test('compares this week with the 4-week average', () => {
    const trips = [
      trip('2026-09-29', 40),
      trip('2026-09-30', 27.4), // this week 67.40
      trip('2026-09-22', 50),
      trip('2026-09-15', 60),
      trip('2026-09-08', 55),
      trip('2026-09-01', 57), // previous 4 weeks avg 55.50
      trip('2026-06-01', 999), // too old
    ];
    const s = spendSummary(trips, today);
    expect(s.thisWeek).toBe(67.4);
    expect(s.lastWeek).toBe(50);
    expect(s.averageWeek).toBe(55.5);
    expect(s.diffVsAverage).toBe(11.9);
    expect(s.thisMonth).toBe(67.4 + 50 + 60 + 55 + 57);
    const text = spendingInsights(s, { weeklyBudget: 80, monthlyBudget: 0, currency: '€' }, today).join('\n');
    expect(text).toContain('You spent €11.90 more this week than your average (€55.50)');
    expect(text).toContain('€12.60 left of your €80.00 weekly budget');
  });

  test('suggests a treat when well under the monthly budget late in the month', () => {
    const s = spendSummary([trip('2026-09-10', 100)], '2026-09-25');
    const text = spendingInsights(s, { weeklyBudget: 0, monthlyBudget: 320, currency: '€' }, '2026-09-25').join('\n');
    expect(text).toMatch(/Treat yourself/);
  });

  test('no data, no average', () => {
    expect(spendSummary([], today).averageWeek).toBeNull();
  });
});
