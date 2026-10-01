import { describe, expect, test } from '@jest/globals';
import { connections, nextWorkout, waterExpected, type Snapshot } from '../../src/shared/connections';

// Thursday 15 October 2026, 15:00
const now = new Date(2026, 9, 15, 15, 0);
const at = (h: number, m = 0) => new Date(2026, 9, 15, h, m).toISOString();
const quiet: Snapshot = {
  now,
  events: [],
  busyMinutes: 0,
  rainWindow: null,
  workoutInMinutes: null,
  waterMl: 1500,
  waterGoal: 2000,
  expiringSoon: [],
  recipe: null,
  shoppingItems: [],
  shoppingEstimate: 0,
  trip: null,
  choresPlannedMinutes: 10,
  budgetLeft: null,
  currency: '€',
  indoorHumidity: null,
  humidityLow: 35,
};
const ids = (s: Partial<Snapshot>) => connections({ ...quiet, ...s }).map((c) => c.id);

describe('cross-module tips', () => {
  test('a quiet day has nothing to say', () => {
    expect(connections(quiet)).toEqual([]);
  });

  test('gym in the calendar → snack 90 minutes before, rain warning for outdoor training', () => {
    const tips = connections({ ...quiet, events: [{ title: 'Gym', start: at(17, 30), end: at(18, 30), allDay: false }] });
    expect(tips[0].text).toBe('Gym at 17:30: have a light carb snack around 16:00 (a banana or toast) for energy.');
    const run = connections({ ...quiet, rainWindow: '16:00–18:00', events: [{ title: 'Evening run', start: at(15, 40), end: at(16, 20), allDay: false }] });
    expect(run.map((t) => t.id)).toEqual(['fuel', 'rain-run']);
    expect(run[0].emoji).toBe('💧');
  });

  test('falls back to the Activity schedule, ignores past events', () => {
    expect(nextWorkout({ ...quiet, events: [{ title: 'Yoga', start: at(9), end: at(10), allDay: false }] })).toBeNull();
    expect(nextWorkout({ ...quiet, workoutInMinutes: 120 })?.minutes).toBe(120);
  });

  test('expiring food → tonight’s recipe', () => {
    const [tip] = connections({ ...quiet, expiringSoon: ['Spinach'], recipe: { name: 'Spinach omelette', emoji: '🍳', usesSoon: ['Spinach'] } });
    expect(tip.text).toBe('Spinach should be used soon. Tonight: 🍳 Spinach omelette.');
    expect(tip.href).toBe('/kitchen');
  });

  test('trip soon → skip fresh food on the shopping list', () => {
    const [tip] = connections({ ...quiet, trip: { destination: 'London', days: 3 }, shoppingItems: ['Milk', 'Dish soap', 'Bread'] });
    expect(tip.text).toBe("You leave for London in 3 days: skip Milk, Bread unless you'll finish them before then.");
    expect(ids({ trip: { destination: 'London', days: 12 }, shoppingItems: ['Milk'] })).toEqual([]);
  });

  test('busy calendar → lighter chores', () => {
    expect(ids({ busyMinutes: 400, choresPlannedMinutes: 40 })).toEqual(['busy']);
    expect(ids({ busyMinutes: 400, choresPlannedMinutes: 10 })).toEqual([]);
  });

  test('water behind the time of day', () => {
    expect(waterExpected(2000, now)).toBe(1000);
    expect(ids({ waterMl: 300 })).toEqual(['water']);
    expect(connections({ ...quiet, waterMl: 300 })[0].text).toContain('700 ml behind');
  });

  test('shopping list bigger than the budget left', () => {
    expect(connections({ ...quiet, budgetLeft: 20, shoppingEstimate: 35.5 })[0].text).toBe(
      "The shopping list (≈€35.50) is more than what's left this month (€20.00).",
    );
    expect(ids({ budgetLeft: -5, shoppingEstimate: 10 })).toEqual(['budget']);
    expect(ids({ budgetLeft: 100, shoppingEstimate: 10 })).toEqual([]);
  });

  test('dry air at home', () => {
    expect(ids({ indoorHumidity: 28 })).toEqual(['dry']);
  });
});
