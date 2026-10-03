import { z } from 'zod';
import { newId } from '../../../shared/dates';
import type { Actions } from './catalog';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('YYYY-MM-DD');
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).describe('HH:MM, 24-hour');
export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

/** One change a plan would make. Nothing happens until the user taps Apply. */
export const PlanChangeSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('event'),
    title: z.string().describe('Short, with an emoji, e.g. "🏃 Run" or "🧹 Clean the bathroom"'),
    date,
    start: hhmm.optional().describe('Leave out for an all-day event'),
    end: hhmm.optional(),
    location: z.string().optional(),
  }),
  z.object({ kind: z.literal('todo'), title: z.string(), due: date.optional(), minutes: z.number().int().optional() }),
  z.object({
    kind: z.literal('meal'),
    date,
    meal: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
    name: z.string().describe('The dish, e.g. "Spinach and feta omelette"'),
    uses: z.array(z.string()).optional().describe('Kitchen items it uses up, especially ones expiring soon'),
  }),
  z.object({ kind: z.literal('shopping'), items: z.array(z.string()).describe('Only what is missing at home') }),
  z.object({
    kind: z.literal('training_days'),
    weekdays: z.array(z.enum(WEEKDAY_NAMES)).describe('The new days for scheduled workouts'),
    time: hhmm.optional(),
  }),
]);
export type PlanChange = z.infer<typeof PlanChangeSchema>;

export const PlanInputSchema = z.object({
  title: z.string().describe('e.g. "Your week, 12–18 Oct" or "Dinners this week"'),
  summary: z.string().describe('One or two short sentences on what the plan does and why'),
  changes: z.array(PlanChangeSchema),
});
export type PlanInput = z.infer<typeof PlanInputSchema>;

export interface Plan extends PlanInput {
  id: string;
  /** What happened when the user tapped Apply, one line per applied change */
  applied?: string[];
}

export const MAX_CHANGES = 40;

export function makePlan(input: PlanInput): Plan {
  if (!input.changes.length) throw new Error('A plan needs at least one change.');
  if (input.changes.length > MAX_CHANGES) throw new Error(`Too many changes (${input.changes.length}); keep a plan to ${MAX_CHANGES}.`);
  return { ...input, id: newId() };
}

const MEAL_EMOJI = { breakfast: '🥣', lunch: '🥗', dinner: '🍽️', snack: '🍎' } as const;
const shortDate = (d: string) => {
  const [y, m, day] = d.split('-').map(Number);
  return `${WEEKDAY_NAMES[new Date(y, m - 1, day).getDay()].slice(0, 3)} ${day}/${m}`;
};

/** One line for the plan card. */
export function changeText(c: PlanChange): string {
  switch (c.kind) {
    case 'event':
      return `📅 ${shortDate(c.date)}${c.start ? ` ${c.start}${c.end ? `–${c.end}` : ''}` : ''}: ${c.title}`;
    case 'todo':
      return `✅ To-do: ${c.title}${c.due ? ` (by ${shortDate(c.due)})` : ''}`;
    case 'meal':
      return `${MEAL_EMOJI[c.meal]} ${shortDate(c.date)} ${c.meal}: ${c.name}${c.uses?.length ? ` (uses ${c.uses.join(', ')})` : ''}`;
    case 'shopping':
      return `🛒 Add to shopping: ${c.items.join(', ')}`;
    case 'training_days':
      return `🏃 Workout days: ${c.weekdays.map((d) => d.slice(0, 3)).join(', ')}${c.time ? ` at ${c.time}` : ''}`;
  }
}

/** Applies the chosen changes through the same actions the chat uses; one result line each. */
export function applyPlan(changes: PlanChange[], actions: Actions): string[] {
  return changes.map((c) => {
    try {
      switch (c.kind) {
        case 'event':
          return actions.addEvent({ title: c.title, date: c.date, start: c.start, end: c.end, location: c.location });
        case 'todo':
          return actions.addTodo({ title: c.title, due: c.due, minutes: c.minutes });
        case 'meal':
          return actions.planMeal({ date: c.date, meal: c.meal, name: c.name });
        case 'shopping':
          return actions.addToShopping(c.items);
        case 'training_days':
          // The Activity schedule counts 1 = Sunday … 7 = Saturday.
          return actions.setTrainingDays(c.weekdays.map((d) => WEEKDAY_NAMES.indexOf(d) + 1), c.time);
      }
    } catch (e) {
      return `Couldn't ${changeText(c)}: ${e instanceof Error ? e.message : String(e)}`;
    }
  });
}

/** Told to the assistant with the next question, since the chat history can't be edited. */
export const appliedNote = (plan: Plan, count: number) =>
  `The user applied ${count === plan.changes.length ? 'all' : `${count} of ${plan.changes.length}`} changes of your plan “${plan.title}”, so they're in the app now.`;
