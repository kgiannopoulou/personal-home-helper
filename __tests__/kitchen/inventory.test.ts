import { describe, expect, test } from '@jest/globals';
import { expiryDigest } from '../../src/modules/kitchen/lib/expiry';
import { categorize, normalizeName, parseShoppingImport, shoppingLink } from '../../src/shared/homeCore';
import {
  buyReason,
  estimateExpiry,
  expiryStatus,
  findItem,
  guessLocation,
  newItem,
  parseCommand,
  predictRunOut,
  restock,
} from '../../src/modules/kitchen/lib/inventory';
import { suggestRecipes } from '../../src/modules/kitchen/lib/recipes';
import type { InventoryItem } from '../../src/modules/kitchen/lib/types';

const TODAY = '2026-09-30';
let n = 0;
const item = (name: string, patch: Partial<InventoryItem> = {}): InventoryItem => ({
  ...newItem(name, { id: String(++n), today: TODAY }),
  ...patch,
});

describe('categories & names', () => {
  test.each([
    ['Dish soap', 'cleaning'],
    ['Soap', 'bathroom'],
    ['Toilet paper', 'bathroom'],
    ['Dog food', 'pet'],
    ['Eggs', 'food'],
    ['Steak', 'food'],
    ['Green tea', 'drinks'],
    ['Watermelon', 'food'],
    ['Trash bags', 'home'],
    ['Mystery thing', 'other'],
  ])('%s → %s', (name, cat) => expect(categorize(name)).toBe(cat));

  test('normalizes plurals', () => {
    expect(normalizeName('Eggs')).toBe('egg');
    expect(normalizeName('Berries')).toBe('berry');
    expect(normalizeName('Tomatoes')).toBe('tomato');
    expect(normalizeName('Glass')).toBe('glass');
  });
});

describe('shelf life & expiry', () => {
  test('guesses where things are stored', () => {
    expect(guessLocation('Milk')).toBe('fridge');
    expect(guessLocation('Bananas')).toBe('pantry');
    expect(guessLocation('Frozen peas')).toBe('freezer');
    expect(guessLocation('Shampoo')).toBe('bathroom');
    expect(guessLocation('Laundry detergent')).toBe('cleaning');
  });

  test('estimates expiry dates', () => {
    expect(estimateExpiry('Spinach', 'fridge', TODAY)).toBe('2026-10-05');
    expect(estimateExpiry('Chicken breast', 'freezer', TODAY)).toBe('2026-12-29');
    expect(estimateExpiry('Bread', 'fridge', TODAY)).toBe('2026-10-05');
    expect(estimateExpiry('Dish soap', 'cleaning', TODAY)).toBeUndefined();
  });

  test('expiry status', () => {
    expect(expiryStatus(item('Milk', { expiresAt: '2026-09-29' }), TODAY)).toEqual({ status: 'expired', daysLeft: -1 });
    expect(expiryStatus(item('Milk', { expiresAt: TODAY }), TODAY)?.status).toBe('today');
    expect(expiryStatus(item('Milk', { expiresAt: '2026-10-02' }), TODAY)?.status).toBe('soon');
    expect(expiryStatus(item('Milk', { expiresAt: '2026-10-09' }), TODAY)?.status).toBe('ok');
    expect(expiryStatus(item('Milk', { expiresAt: '2026-09-01', level: 'empty' }), TODAY)).toBeNull();
  });
});

describe('predicting when things run out', () => {
  test('needs three purchases', () => {
    expect(predictRunOut(item('Toilet paper', { purchases: ['2026-09-01', '2026-09-15'] }), TODAY)).toBeNull();
  });

  test('uses the average gap between purchases', () => {
    const tp = item('Toilet paper', { purchases: ['2026-09-02', '2026-09-16', '2026-09-30'] });
    expect(predictRunOut(tp, TODAY)).toEqual({ everyDays: 14, runsOutOn: '2026-10-14', daysLeft: 14 });
    expect(buyReason(tp, '2026-10-12')).toBe('predicted');
    expect(buyReason(tp, '2026-10-01')).toBeNull();
    expect(buyReason({ ...tp, level: 'low' }, TODAY)).toBe('low');
  });

  test('restocking records a purchase and refreshes expiry', () => {
    const milk = item('Milk', { level: 'empty', purchases: ['2026-09-20'] });
    const again = restock(milk, TODAY);
    expect(again.level).toBe('full');
    expect(again.purchases).toEqual(['2026-09-20', TODAY]);
    expect(again.expiresAt).toBe('2026-10-07');
  });
});

describe('everyday sentences', () => {
  test.each([
    ['I finished the milk', 'empty', ['milk']],
    ['out of eggs and bread', 'empty', ['eggs', 'bread']],
    ["We're out of dish soap.", 'empty', ['dish soap']],
    ['The toilet paper is finished', 'empty', ['toilet paper']],
    ['dish soap is low', 'low', ['dish soap']],
    ['running low on coffee', 'low', ['coffee']],
    ['bought milk, eggs and spinach', 'bought', ['milk', 'eggs', 'spinach']],
    ['the juice is half', 'half', ['juice']],
  ])('"%s"', (text, action, names) => {
    expect(parseCommand(text)).toEqual({ action, names });
  });

  test('unknown sentences return null', () => {
    expect(parseCommand('hello there')).toBeNull();
  });

  test('finds items loosely', () => {
    const items = [item('Eggs'), item('Semi-skimmed milk'), item('Dish soap')];
    expect(findItem(items, 'the egg')?.name).toBe('Eggs');
    expect(findItem(items, 'milk')?.name).toBe('Semi-skimmed milk');
    expect(findItem(items, 'bread')).toBeUndefined();
  });
});

describe('use-it-up suggestions', () => {
  test('suggests a recipe for spinach that expires soon', () => {
    const items = [item('Spinach', { expiresAt: '2026-10-01' }), item('Eggs'), item('Bread')];
    const [first] = suggestRecipes(items, TODAY);
    expect(first.recipe.name).toBe('Spinach omelette + toast');
    expect(first.usesSoon).toEqual(['spinach']);
    expect(first.missing).toEqual([]);
  });

  test('nothing expiring → no suggestions', () => {
    expect(suggestRecipes([item('Rice')], TODAY)).toEqual([]);
  });

  test('expiry notices are grouped by day, the morning before', () => {
    const items = [item('Spinach', { expiresAt: '2026-10-03' }), item('Yogurt', { expiresAt: '2026-10-03' }), item('Rice')];
    const notices = expiryDigest(items, new Date(2026, 8, 30, 12));
    expect(notices).toHaveLength(1);
    expect(notices[0].at).toEqual(new Date(2026, 9, 2, 9));
    expect(notices[0].title).toContain('Spinach, Yogurt');
  });
});

describe('link to the shopping app', () => {
  test('round-trips items and spend', () => {
    const link = shoppingLink({ items: ['Milk', 'Dish soap & sponges'], spend: 23.4, store: 'Lidl', date: TODAY });
    expect(link.startsWith('smartshopping://add?')).toBe(true);
    const params = Object.fromEntries(new URL(link.replace('smartshopping://', 'https://x/')).searchParams);
    expect(parseShoppingImport(params)).toEqual({ items: ['Milk', 'Dish soap & sponges'], spend: 23.4, store: 'Lidl', date: TODAY });
  });

  test('rejects junk', () => {
    expect(parseShoppingImport({ spend: '-5', date: 'yesterday' })).toEqual({ items: [], spend: undefined, store: undefined, date: undefined });
  });
});
