import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { EXPENSE_CATEGORIES } from '../../money/lib/budget';
import { HISTORY_MODULES, SECTIONS, type Actions, type HistoryModule } from './catalog';
import { FACT_KINDS, type FactKind, type MemoryBox } from './memory';
import { makePlan, PlanInputSchema, type Plan, type PlanInput } from './plan';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('YYYY-MM-DD');
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).describe('HH:MM, 24-hour');
const items = z.array(z.string().min(1)).min(1).max(30);

/** One record per tool call, so the chat can show what the assistant did. */
export interface ActionLog {
  tool: string;
  result: string;
  /** A proposed plan, shown as a card the user can apply */
  plan?: Plan;
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
        if (!name.startsWith('look_up')) log({ tool: name, result });
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
      name: 'look_up_history',
      description:
        'Read compact totals over the past days, for trends and "why" questions (over budget, sleeping worse, what keeps slipping). money: spending per week and category, change versus the period before, weeks with vs without a big grocery shop. food: average water and food, weekdays vs weekends. activity: steps, sleep and workouts per week, and how days go after good vs short sleep. chores: what keeps slipping and when chores get done. shopping: trips, usual days, how often each item gets bought.',
      inputSchema: z.object({
        module: z.enum(HISTORY_MODULES),
        days: z.number().int().min(7).max(365).describe('How far back, e.g. 28 for about a month, 91 for three months'),
      }),
      run: run('look_up_history', (i: { module: HistoryModule; days: number }) => actions.lookUpHistory(i.module, i.days)),
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
      name: 'update_kitchen_stock',
      description:
        'Update the kitchen inventory from what a photo of the fridge, freezer or cupboard shows: how full each item looks, and items not tracked yet. Only include what you can see; things outside the picture are not empty.',
      inputSchema: z.object({
        items: z
          .array(
            z.object({
              name: z.string().min(1).describe('Short everyday name, e.g. "Milk", "Greek yogurt"'),
              level: z.enum(['full', 'half', 'low', 'empty']),
              location: z.enum(['fridge', 'freezer', 'pantry', 'bathroom', 'cleaning', 'other']),
              category: z.enum(['food', 'drinks', 'cleaning', 'bathroom', 'home', 'pet', 'other']),
              shelf_life_days: z.number().int().min(0).max(730).optional().describe('For new items: typical days it keeps there once opened or bought; 0 if it keeps for long'),
            }),
          )
          .min(1)
          .max(40),
      }),
      run: run('update_kitchen_stock', (i: { items: { name: string; level: 'full' | 'half' | 'low' | 'empty'; location: 'fridge' | 'freezer' | 'pantry' | 'bathroom' | 'cleaning' | 'other'; category: 'food' | 'drinks' | 'cleaning' | 'bathroom' | 'home' | 'pet' | 'other'; shelf_life_days?: number }[] }) =>
        actions.updateKitchenStock(i.items.map(({ shelf_life_days, ...rest }) => ({ ...rest, shelfLifeDays: shelf_life_days }))),
      ),
    }),
    betaZodTool({
      name: 'add_bill',
      description: 'Add a bill, invoice or renewal (e.g. from a photo) to life admin, with its due date and amount, so the user is reminded before it is due.',
      inputSchema: z.object({
        title: z.string().min(1).describe('Who and what, e.g. "Electricity – DEI" or "Car insurance renewal"'),
        kind: z.enum(['bill', 'renewal', 'appointment', 'other']),
        due: date,
        amount: z.number().positive().max(100000).optional(),
        repeat_months: z.number().int().min(0).max(24).optional().describe('1 for monthly bills, 12 for yearly renewals, 0 or leave out for one-offs'),
      }),
      run: run('add_bill', (i: { title: string; kind: 'bill' | 'renewal' | 'appointment' | 'other'; due: string; amount?: number; repeat_months?: number }) =>
        actions.addBill({ title: i.title, kind: i.kind, due: i.due, amount: i.amount, repeatMonths: i.repeat_months }),
      ),
    }),
    betaZodTool({
      name: 'propose_plan',
      description:
        'Propose a bigger plan the user can apply with one tap: a week plan (events in free time for workouts, chores and errands, to-dos), a meal plan (meals on given days, missing ingredients for the shopping list), or new workout days. Nothing changes until they tap Apply on the card, so do not also make these changes with other tools.',
      inputSchema: PlanInputSchema,
      run: async (input: PlanInput) => {
        try {
          const plan = makePlan(input);
          log({ tool: 'propose_plan', result: `Proposed “${plan.title}”`, plan });
          return `Shown to the user as a card with ${plan.changes.length} changes and an Apply button. Nothing has changed yet.`;
        } catch (e) {
          return `Error: ${e instanceof Error ? e.message : String(e)}`;
        }
      },
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
