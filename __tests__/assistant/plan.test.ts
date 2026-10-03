import { describe, expect, jest, test } from '@jest/globals';
import type { Actions } from '../../src/modules/assistant/lib/catalog';
import { appliedNote, applyPlan, changeText, makePlan, MAX_CHANGES, PlanInputSchema, type PlanChange } from '../../src/modules/assistant/lib/plan';

const changes: PlanChange[] = [
  { kind: 'event', title: '🏃 Run', date: '2026-10-06', start: '07:00', end: '07:40' },
  { kind: 'todo', title: 'Call the dentist', due: '2026-10-07' },
  { kind: 'meal', date: '2026-10-06', meal: 'dinner', name: 'Spinach omelette', uses: ['Spinach', 'Eggs'] },
  { kind: 'shopping', items: ['Feta', 'Lemons'] },
  { kind: 'training_days', weekdays: ['Tuesday', 'Saturday'], time: '07:00' },
];

const fakeActions = () =>
  ({
    addEvent: jest.fn(() => 'Added event'),
    addTodo: jest.fn(() => 'Added to-do'),
    planMeal: jest.fn(() => 'Planned meal'),
    addToShopping: jest.fn(() => 'Added to shopping'),
    setTrainingDays: jest.fn(() => 'Moved workouts'),
  }) as unknown as Actions;

describe('plans', () => {
  test('each change reads as one line on the card', () => {
    expect(changes.map(changeText)).toEqual([
      '📅 Tue 6/10 07:00–07:40: 🏃 Run',
      '✅ To-do: Call the dentist (by Wed 7/10)',
      '🍽️ Tue 6/10 dinner: Spinach omelette (uses Spinach, Eggs)',
      '🛒 Add to shopping: Feta, Lemons',
      '🏃 Workout days: Tue, Sat at 07:00',
    ]);
  });

  test('applying runs each chosen change through the app actions', () => {
    const actions = fakeActions();
    expect(applyPlan(changes, actions)).toEqual(['Added event', 'Added to-do', 'Planned meal', 'Added to shopping', 'Moved workouts']);
    expect(actions.addEvent).toHaveBeenCalledWith({ title: '🏃 Run', date: '2026-10-06', start: '07:00', end: '07:40', location: undefined });
    expect(actions.planMeal).toHaveBeenCalledWith({ date: '2026-10-06', meal: 'dinner', name: 'Spinach omelette' });
    // The Activity schedule counts 1 = Sunday.
    expect(actions.setTrainingDays).toHaveBeenCalledWith([3, 7], '07:00');
  });

  test('one failing change does not stop the rest', () => {
    const actions = fakeActions();
    actions.addTodo = () => {
      throw new Error('planner not ready');
    };
    const results = applyPlan(changes.slice(0, 3), actions);
    expect(results[1]).toBe("Couldn't ✅ To-do: Call the dentist (by Wed 7/10): planner not ready");
    expect(results[2]).toBe('Planned meal');
  });

  test('a plan needs changes, and not too many', () => {
    expect(makePlan({ title: 'Week', summary: 's', changes }).id).toEqual(expect.any(String));
    expect(() => makePlan({ title: 'Week', summary: 's', changes: [] })).toThrow();
    expect(() => makePlan({ title: 'Week', summary: 's', changes: Array(MAX_CHANGES + 1).fill(changes[0]) })).toThrow(/Too many/);
  });

  test('bad dates and times are rejected', () => {
    expect(() => PlanInputSchema.parse({ title: 't', summary: 's', changes: [{ kind: 'event', title: 'x', date: 'Monday' }] })).toThrow();
    expect(() => PlanInputSchema.parse({ title: 't', summary: 's', changes: [{ kind: 'event', title: 'x', date: '2026-10-06', start: '7pm' }] })).toThrow();
    expect(() => PlanInputSchema.parse({ title: 't', summary: 's', changes: [{ kind: 'training_days', weekdays: ['Funday'] }] })).toThrow();
  });

  test('the assistant is told what was applied', () => {
    const plan = makePlan({ title: 'Your week', summary: 's', changes });
    expect(appliedNote(plan, 5)).toBe('The user applied all changes of your plan “Your week”, so they\'re in the app now.');
    expect(appliedNote(plan, 3)).toMatch(/applied 3 of 5 changes/);
  });
});
