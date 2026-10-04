import { describe, expect, test } from '@jest/globals';
import { newId, toDateKey } from '../../src/shared/dates';
import { COLLECTION_BY_NAME, sleepToTimes, stepsId } from '../../src/shared/sync/collections';
import type { Row } from '../../src/shared/sync/types';

const ctx = { userId: 7 };

/** Phone record → server row → phone record gives the same record back. */
function roundTrip(name: string, record: { id: string }) {
  const c = COLLECTION_BY_NAME[name];
  const row: Row = { id: record.id, ...c.toRow(record, ctx), updated_at: '2026-10-03T10:00:00.000Z', deleted_at: null };
  return c.fromRow(row, record, ctx);
}

describe('each record survives the trip to the server and back', () => {
  test.each([
    ['expenses', { id: 'e', date: '2026-10-01', amount: 12.5, category: 'groceries', note: 'Lidl', source: 'shopping', recurringId: undefined }],
    ['recurring_bills', { id: 'r', name: 'Rent', amount: 620, category: 'bills', dayOfMonth: 1 }],
    ['shopping_trips', { id: 't', date: '2026-10-03', total: 54.3, store: 'Lidl', itemCount: 17, source: 'receipt' }],
    ['shopping_items', { id: 's', name: 'Milk', category: 'drinks', quantity: '2', price: undefined, checked: false, addedAt: '2026-10-01T08:00:00.000Z', source: 'manual' }],
    ['inventory_items', { id: 'i', name: 'Feta', category: 'food', location: 'fridge', level: 'half', quantity: undefined, boughtAt: '2026-09-26', expiresAt: '2026-10-09', price: 4.8, purchases: ['2026-09-12', '2026-09-26'] }],
    ['rooms', { id: 'k', name: 'Kitchen', emoji: '🍳', personal: undefined }],
    ['chores', { id: 'c', name: 'Mop', roomId: 'k', everyDays: 7, minutes: 15, lastDone: '2026-10-01T18:00:00.000Z', assignee: '8', learned: { from: 3, on: '2026-09-20', seen: true }, fixedFrequency: undefined }],
    ['chore_completions', { id: 'd', taskId: 'c', at: '2026-10-01T18:00:00.000Z', by: '7', minutes: 15 }],
    ['supplies', { id: 'u', name: 'Bleach', category: 'cleaning', level: 'low' }],
    ['food_entries', { id: 'f', date: '2026-10-03', time: '2026-10-03T10:30:00.000Z', name: 'Salad', grams: 350, meal: 'lunch', source: 'ai', kcal: 430, protein: 38, carbs: 18, fat: 22.5, fiber: 6 }],
    ['water_entries', { id: 'w', date: '2026-10-03', time: '2026-10-03T08:00:00.000Z', ml: 250, drink: 'tea' }],
    ['workouts', { id: 'o', date: '2026-10-02', type: 'run', minutes: 30, intensity: 'moderate', kcal: 270, source: 'coach', notes: undefined }],
    ['sleep_entries', { id: 'z', date: '2026-10-03', bedtime: '23:15', wake: '07:00', hours: 7.8, quality: 4 }],
    ['weights', { id: 'g', date: '2026-10-03', kg: 70.4 }],
    ['step_counts', { id: stepsId(7, '2026-10-03'), date: '2026-10-03', steps: 8123 }],
    ['events', { id: 'v', title: 'Dentist', start: '2026-10-06T07:30:00.000Z', end: '2026-10-06T08:15:00.000Z', allDay: false, location: 'Kypseli', source: 'manual' }],
    ['todos', { id: 'x', title: 'Call the plumber', due: '2026-10-04', minutes: 10, done: undefined, createdAt: '2026-10-01T09:00:00.000Z' }],
    ['admin_items', { id: 'a', title: 'Car insurance', kind: 'renewal', due: '2026-11-01', repeatMonths: 12, remindDays: 14, amount: 310, done: undefined, history: ['2025-11-01T09:00:00.000Z'] }],
  ])('%s', (name, record) => {
    expect(roundTrip(name, record)).toEqual(record);
  });
});

describe('details', () => {
  test('a day of steps has the same id on every phone of that person, and on the server', () => {
    // StepCount::idFor(7, '2026-10-04') in home-helper-api
    expect(stepsId(7, '2026-10-04')).toBe('01m423bp000000000000000007');
    expect(stepsId(8, '2026-10-04')).not.toBe(stepsId(7, '2026-10-04'));
  });

  test('steps sync once the day is over, and today stays as it is', () => {
    const c = COLLECTION_BY_NAME.step_counts;
    const today = toDateKey();
    const state = { steps: { '2026-10-01': 9000, '2026-10-02': 0, [today]: 1200 } } as never;
    const days = c.get(state, ctx);
    expect(days).toEqual([{ id: stepsId(7, '2026-10-01'), date: '2026-10-01', steps: 9000 }]);
    const merged = c.set(state, [...days, { id: stepsId(7, '2026-09-30'), date: '2026-09-30', steps: 4000 }] as never) as unknown as { steps: Record<string, number> };
    expect(merged.steps).toEqual({ '2026-10-01': 9000, '2026-09-30': 4000, [today]: 1200 });
  });

  test('a night\'s sleep crosses midnight', () => {
    const { bed_at, woke_at } = sleepToTimes({ date: '2026-10-03', bedtime: '23:15', wake: '07:00' });
    expect((Date.parse(woke_at) - Date.parse(bed_at)) / 3600000).toBe(7.75);
    expect(new Date(bed_at).getDate()).toBe(2);

    const afterMidnight = sleepToTimes({ date: '2026-10-03', bedtime: '00:30', wake: '08:00' });
    expect(new Date(afterMidnight.bed_at).getDate()).toBe(3);
  });

  test('members only become users when they are household users', () => {
    const c = COLLECTION_BY_NAME.chores;
    expect(c.toRow({ id: 'c', name: 'Mop', roomId: 'k', everyDays: 7, minutes: 15, assignee: 'local-member' } as never, ctx)).toMatchObject({ assignee_id: null });
    expect(c.toRow({ id: 'c', name: 'Mop', roomId: 'k', everyDays: 7, minutes: 15, assignee: '8' } as never, ctx)).toMatchObject({ assignee_id: 8 });
  });

  test('a kitchen item from the server keeps the price you entered here', () => {
    const c = COLLECTION_BY_NAME.inventory_items;
    const row: Row = { id: 'i', name: 'Feta', category: 'food', location: 'fridge', level: 'low', quantity: null, expires_on: null, purchases: ['2026-09-26', '2026-10-03'], updated_at: '2026-10-03T10:00:00Z' };
    expect(c.fromRow(row, { id: 'i', name: 'Feta', price: 4.8, purchases: [], boughtAt: '2026-09-01' } as never, ctx)).toMatchObject({ level: 'low', price: 4.8, boughtAt: '2026-10-03' });
  });
});

describe('ids', () => {
  test('new ids are ULIDs the server can store, in time order', () => {
    const a = newId(Date.UTC(2026, 9, 3, 10));
    const b = newId(Date.UTC(2026, 9, 3, 10, 0, 1));
    expect(a).toMatch(/^[0-9a-hjkmnp-tv-z]{26}$/);
    expect(a.slice(0, 10) < b.slice(0, 10)).toBe(true);
    expect(newId()).not.toBe(newId());
  });
});
