import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { EXPENSE_CATEGORIES } from '../../money/lib/budget';
import { SECTIONS, type Actions } from './catalog';
import { FACT_KINDS, type FactKind, type MemoryBox } from './memory';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('YYYY-MM-DD');
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).describe('HH:MM, 24-hour');
const items = z.array(z.string().min(1)).min(1).max(30);

/** One record per tool call, so the chat can show what the assistant did. */
export interface ActionLog {
  tool: string;
  result: string;
}

/**
 * The assistant's tools, bound to the app's real data. Order and wording stay fixed so the
 * tool list is cached between requests.
 */
export function makeTools(actions: Actions, log: (entry: ActionLog) => void, memory: MemoryBox) {
  const run =
    <I,>(name: string, fn: (input: I) => string) =>
    async (input: I) => {
      try {
        const result = fn(input);
        if (name !== 'look_up') log({ tool: name, result });
        return result;
      } catch (e) {
        return `Error: ${e instanceof Error ? e.message : String(e)}`;
      }
    };

  return [
    betaZodTool({
      name: 'look_up',
      description:
        'Read more detail than today’s summary: kitchen (every item, level, expiry), shopping (full list), chores (every task, frequency, when due), calendar_week (next 7 days), todos (all open), food_week (7-day nutrition averages and gaps), activity_week, money (this month by category and recent expenses), forecast (7 days).',
      inputSchema: z.object({ section: z.enum(SECTIONS) }),
      run: run('look_up', (i: { section: (typeof SECTIONS)[number] }) => actions.lookUp(i.section)),
    }),
    betaZodTool({
      name: 'add_to_shopping_list',
      description: 'Add items to the shopping list. Use short everyday names (e.g. "Milk", "Dish soap").',
      inputSchema: z.object({ items }),
      run: run('add_to_shopping_list', (i: { items: string[] }) => actions.addToShopping(i.items)),
    }),
    betaZodTool({
      name: 'mark_finished',
      description: 'The user used up or ran out of something: marks it empty in the kitchen inventory and adds it to the shopping list.',
      inputSchema: z.object({ items }),
      run: run('mark_finished', (i: { items: string[] }) => actions.markFinished(i.items)),
    }),
    betaZodTool({
      name: 'mark_bought',
      description: 'The user bought or restocked things: marks them full in the kitchen inventory.',
      inputSchema: z.object({ items }),
      run: run('mark_bought', (i: { items: string[] }) => actions.markBought(i.items)),
    }),
    betaZodTool({
      name: 'log_water',
      description: 'Log water the user drank.',
      inputSchema: z.object({ ml: z.number().int().min(50).max(3000) }),
      run: run('log_water', (i: { ml: number }) => actions.logWater(i.ml)),
    }),
    betaZodTool({
      name: 'log_food',
      description: 'Log something the user ate, with your best estimate of its nutrition for the portion they describe.',
      inputSchema: z.object({
        name: z.string().min(1),
        meal: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
        kcal: z.number().min(0).max(5000),
        protein: z.number().min(0).max(300).describe('grams'),
        carbs: z.number().min(0).max(800).describe('grams'),
        fat: z.number().min(0).max(300).describe('grams'),
        fiber: z.number().min(0).max(100).describe('grams'),
      }),
      run: run('log_food', (i: Parameters<Actions['logFood']>[0]) => actions.logFood(i)),
    }),
    betaZodTool({
      name: 'log_workout',
      description: 'Log a workout the user did.',
      inputSchema: z.object({
        type: z.enum(['run', 'walk', 'gym', 'cycle', 'swim', 'hiit', 'yoga', 'other']),
        minutes: z.number().int().min(1).max(600),
        intensity: z.enum(['easy', 'moderate', 'hard']),
      }),
      run: run('log_workout', (i: Parameters<Actions['logWorkout']>[0]) => actions.logWorkout(i)),
    }),
    betaZodTool({
      name: 'add_todo',
      description: 'Add a to-do or errand to the planner.',
      inputSchema: z.object({ title: z.string().min(1), due: date.optional(), minutes: z.number().int().min(1).max(600).optional() }),
      run: run('add_todo', (i: Parameters<Actions['addTodo']>[0]) => actions.addTodo(i)),
    }),
    betaZodTool({
      name: 'add_event',
      description: 'Add an event to the planner calendar. Leave out start for an all-day event.',
      inputSchema: z.object({ title: z.string().min(1), date, start: hhmm.optional(), end: hhmm.optional(), location: z.string().optional() }),
      run: run('add_event', (i: Parameters<Actions['addEvent']>[0]) => actions.addEvent(i)),
    }),
    betaZodTool({
      name: 'add_expense',
      description: 'Log money the user spent.',
      inputSchema: z.object({ amount: z.number().positive().max(100000), category: z.enum(EXPENSE_CATEGORIES as [string, ...string[]]), note: z.string().optional() }),
      run: run('add_expense', (i: { amount: number; category: string; note?: string }) =>
        actions.addExpense(i as Parameters<Actions['addExpense']>[0]),
      ),
    }),
    betaZodTool({
      name: 'complete_chore',
      description: 'Mark a household chore or personal routine as done, by its name.',
      inputSchema: z.object({ name: z.string().min(1) }),
      run: run('complete_chore', (i: { name: string }) => actions.completeChore(i.name)),
    }),
    betaZodTool({
      name: 'add_chore_to_today',
      description: "Put a chore on today's plan, by its name.",
      inputSchema: z.object({ name: z.string().min(1) }),
      run: run('add_chore_to_today', (i: { name: string }) => actions.addChoreToToday(i.name)),
    }),
    betaZodTool({
      name: 'start_laundry',
      description: 'Start the laundry timer; the user gets a notification when it should be done.',
      inputSchema: z.object({ type: z.enum(['whites', 'colours', 'darks', 'mixed']), minutes: z.number().int().min(10).max(300).optional() }),
      run: run('start_laundry', (i: { type: 'whites' | 'colours' | 'darks' | 'mixed'; minutes?: number }) => actions.startLaundry(i.type, i.minutes)),
    }),
    betaZodTool({
      name: 'remember',
      description:
        'Save a lasting fact about the user so you know it in future chats: a preference or dislike, a routine, a goal, a person in their life, or a health fact that matters for advice (allergy, intolerance, injury). One short fact in third person, e.g. "Doesn’t like mushrooms", "Gym on Tuesday and Thursday evenings". Not for one-off things the app already tracks (meals, expenses, events).',
      inputSchema: z.object({ fact: z.string().min(3).max(200), kind: z.enum(FACT_KINDS) }),
      run: run('remember', (i: { fact: string; kind: FactKind }) => memory.remember(i.fact, i.kind)),
    }),
    betaZodTool({
      name: 'forget',
      description: 'Forget remembered facts that contain these words, when the user asks or a fact is no longer true. To change a fact, forget the old one, then remember the new one.',
      inputSchema: z.object({ about: z.string().min(2) }),
      run: run('forget', (i: { about: string }) => memory.forget(i.about)),
    }),
  ];
}
