import { describe, expect, jest, test } from '@jest/globals';
import { findByName, type Actions } from '../../src/modules/assistant/lib/catalog';
import { SYSTEM, userTurn } from '../../src/modules/assistant/lib/assistant';
import { todayContext } from '../../src/modules/assistant/lib/context';
import { makeTools, type ActionLog } from '../../src/modules/assistant/lib/tools';
import type { HubData } from '../../src/shared/useHub';

const fakeActions = (): Actions => ({
  addToShopping: jest.fn((items: string[]) => `Added ${items.join(', ')}`),
  markFinished: jest.fn((items: string[]) => `Finished ${items.join(', ')}`),
  markBought: jest.fn(() => 'Restocked'),
  logWater: jest.fn((ml: number) => `Logged ${ml} ml`),
  logFood: jest.fn(() => 'Logged food'),
  logWorkout: jest.fn(() => 'Logged workout'),
  addTodo: jest.fn(() => 'Added to-do'),
  addEvent: jest.fn(() => 'Added event'),
  addExpense: jest.fn(() => 'Logged expense'),
  completeChore: jest.fn(() => 'Done'),
  addChoreToToday: jest.fn(() => 'Pinned'),
  startLaundry: jest.fn(() => 'Laundry on'),
  lookUp: jest.fn(() => 'details'),
});

// The tools have different input types; tests call them through one loose shape.
type AnyTool = { name: string; run: (input: any) => Promise<unknown> | unknown; parse: (input: unknown) => any };
const toolMap = (actions: Actions, log: (e: ActionLog) => void = () => {}) =>
  Object.fromEntries((makeTools(actions, log) as AnyTool[]).map((t) => [t.name, t])) as Record<string, AnyTool>;

describe('tools', () => {
  test('one tool per action, in a fixed order (so the list stays cached)', () => {
    const names = makeTools(fakeActions(), () => {}).map((t) => t.name);
    expect(names).toEqual([
      'look_up',
      'add_to_shopping_list',
      'mark_finished',
      'mark_bought',
      'log_water',
      'log_food',
      'log_workout',
      'add_todo',
      'add_event',
      'add_expense',
      'complete_chore',
      'add_chore_to_today',
      'start_laundry',
    ]);
  });

  test('run the matching action and log what changed (but not look-ups)', async () => {
    const actions = fakeActions();
    const log: ActionLog[] = [];
    const tools = toolMap(actions, (e) => log.push(e));
    expect(await tools.add_to_shopping_list.run(tools.add_to_shopping_list.parse({ items: ['Milk', 'Eggs'] }))).toBe('Added Milk, Eggs');
    expect(await tools.log_water.run(tools.log_water.parse({ ml: 250 }))).toBe('Logged 250 ml');
    expect(await tools.look_up.run(tools.look_up.parse({ section: 'kitchen' }))).toBe('details');
    expect(actions.lookUp).toHaveBeenCalledWith('kitchen');
    expect(log).toEqual([
      { tool: 'add_to_shopping_list', result: 'Added Milk, Eggs' },
      { tool: 'log_water', result: 'Logged 250 ml' },
    ]);
  });

  test('inputs are validated before anything changes', () => {
    const tools = toolMap(fakeActions());
    expect(() => tools.log_water.parse({ ml: 99999 })).toThrow();
    expect(() => tools.add_event.parse({ title: 'Dentist', date: 'tomorrow' })).toThrow();
    expect(() => tools.add_expense.parse({ amount: 12, category: 'yachts' })).toThrow();
    expect(() => tools.look_up.parse({ section: 'secrets' })).toThrow();
    expect(tools.add_event.parse({ title: 'Dentist', date: '2026-10-20', start: '09:30' })).toEqual({ title: 'Dentist', date: '2026-10-20', start: '09:30' });
  });

  test('a failing action becomes an error result instead of crashing the chat', async () => {
    const actions = fakeActions();
    actions.completeChore = () => {
      throw new Error('store not ready');
    };
    const log: ActionLog[] = [];
    const tool = toolMap(actions, (e) => log.push(e)).complete_chore;
    expect(await tool.run({ name: 'Vacuum' })).toBe('Error: store not ready');
    expect(log).toEqual([]);
  });
});

describe('names the user says', () => {
  const tasks = [{ name: 'Clean toilet' }, { name: 'Vacuum' }, { name: 'Change bedsheets' }];
  test('exact, then partial, plural-insensitive', () => {
    expect(findByName(tasks, 'vacuum')?.name).toBe('Vacuum');
    expect(findByName(tasks, 'bedsheet')?.name).toBe('Change bedsheets');
    expect(findByName(tasks, 'toilet')?.name).toBe('Clean toilet');
    expect(findByName(tasks, 'windows')).toBeUndefined();
  });
});

describe('prompt', () => {
  test('the system prompt has no dates or data, so it caches', () => {
    expect(SYSTEM).not.toMatch(/\d{4}-\d{2}-\d{2}|20\d\d/);
  });

  test("each question carries that moment's data", () => {
    expect(userTurn('Now: Thursday', 'Plan my day')).toEqual({ role: 'user', content: '<today>\nNow: Thursday\n</today>\n\nPlan my day' });
  });

  test('today’s context summarises every part of the app', () => {
    const now = new Date(2026, 9, 15, 15, 0);
    const hub = {
      now,
      tips: [{ id: 'water', emoji: '💧', text: 'Have a glass of water.', href: '/quick' }],
      planner: {
        date: '2026-10-15',
        events: [{ id: 'e', title: 'Gym', start: new Date(2026, 9, 15, 18).toISOString(), end: new Date(2026, 9, 15, 19).toISOString(), allDay: false, source: 'manual' }],
        gaps: [{ start: new Date(2026, 9, 15, 15, 5), end: new Date(2026, 9, 15, 18), minutes: 175 }],
        todos: [{ id: 't', title: 'Post office', minutes: 30, due: '2026-10-14', createdAt: '' }],
        admin: [],
        birthdays: [{ person: { name: 'Mom', interests: 'gardening' }, daysUntil: 5 }],
        trips: [],
        busyMinutes: 60,
      },
      food: { waterMl: 800, waterGoal: 2000, nutrients: { kcal: 950, protein: 40, carbs: 100, fat: 30, fiber: 12 }, targets: null },
      activity: { steps: 5200, stepGoal: 8000, level: 3, workoutInMinutes: null },
      kitchen: { total: 12, expiring: ['Spinach'], low: ['Eggs (low)'], recipe: { name: 'Spinach omelette' } },
      shopping: { count: 2, estimate: 4.2, currency: '€' },
      money: { spent: 612, budget: 1200, currency: '€' },
      chores: { minutes: 10, capacity: 20, tasks: [{ name: 'Wash dishes', minutes: 10 }], laundry: null },
      weather: { forecast: null, outfit: null, rain: null, indoor: { humidity: 30 } },
    } as unknown as HubData;
    const text = todayContext(hub);
    expect(text).toContain('Now: Thursday 15 October 2026, 15:00');
    expect(text).toContain('Calendar today: 18:00–19:00 Gym | busy 1 h');
    expect(text).toContain('To-dos due: Post office (30 min) [overdue]');
    expect(text).toContain('Birthdays: Mom in 5 days (likes gardening)');
    expect(text).toContain('water 800/2000 ml | 950 kcal, protein 40 g');
    expect(text).toContain('(no profile set, so no targets)');
    expect(text).toContain('use soon: Spinach | low or empty: Eggs (low) | recipe idea: Spinach omelette');
    expect(text).toContain('Money: €612.00 spent this month of €1200 budget (€588.00 left)');
    expect(text).toContain('Chores planned today (10 of 20 free min): Wash dishes (10 min)');
    expect(text).toContain('Indoors: humidity 30%');
    expect(text).toContain('App tips right now: Have a glass of water.');
  });
});
