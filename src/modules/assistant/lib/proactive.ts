import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { addDays } from '../../planner/lib/planner';
import { fromDateKey, toDateKey } from '../../../shared/dates';
import { AssistantError, friendlyError } from './assistant';
import { longDate } from './context';
import { makePlan, PlanInputSchema, type Plan } from './plan';

/** The app sections a nudge can open. */
export const NUDGE_MODULES = ['planner', 'food', 'activity', 'kitchen', 'shopping', 'money', 'chores', 'weather'] as const;

const NudgesSchema = z.object({
  nudges: z.array(
    z.object({
      emoji: z.string(),
      text: z.string().describe('One short line, at most about 110 characters'),
      module: z.enum(NUDGE_MODULES).describe('Where the user would act on it'),
    }),
  ),
});
export type Nudge = z.infer<typeof NudgesSchema>['nudges'][number];

export interface DailyBriefing {
  /** The day the nudges are for, YYYY-MM-DD */
  date: string;
  nudges: Nudge[];
}

const ReviewSchema = z.object({
  headline: z.string().describe('One upbeat line summing up the week'),
  budget: z.string().describe('Budget pace: spent this week and month vs budget, where it went, one or two short sentences'),
  nutrition: z.string().describe('Nutrition and water gaps this week, one or two short sentences'),
  chores: z.string().describe('Chores that slipped and what went well, one or two short sentences'),
  plan: PlanInputSchema.describe('A suggested plan for next week; changes may be empty if nothing is worth adding'),
});

export interface WeeklyReview {
  /** Monday of the week reviewed, YYYY-MM-DD */
  week: string;
  headline: string;
  budget: string;
  nutrition: string;
  chores: string;
  /** Next week's plan, applied only after the user taps Apply */
  plan: Plan | null;
}

/** What the proactive calls read, gathered from the app as plain text. */
export interface ProactiveInput {
  /** todayContext() */
  today: string;
  calendarWeek: string;
  forecast: string;
  /** Kitchen and chores detail, for the weekly plan */
  kitchen?: string;
  chores?: string;
  foodWeek?: string;
  /** historySummary() per module */
  history: { money: string; food: string; activity: string; chores: string };
  /** memoryText() */
  memory: string;
}

// ── When ─────────────────────────────────────────────────────────────────

/** From 17:00 the briefing is written for tomorrow, so it can go into the morning notification. */
export const EVENING_HOUR = 17;

export function briefingTarget(now: Date = new Date()): { date: string; tomorrow: boolean } {
  const today = toDateKey(now);
  return now.getHours() >= EVENING_HOUR ? { date: addDays(today, 1), tomorrow: true } : { date: today, tomorrow: false };
}

/** Monday of the week to review: this week on Sunday, last week if you first open the app on Monday. Otherwise null. */
export function reviewWeek(now: Date = new Date()): string | null {
  const today = toDateKey(now);
  if (now.getDay() === 0) return addDays(today, -6);
  if (now.getDay() === 1) return addDays(today, -7);
  return null;
}

// ── Prompts (fixed, so they're cached) ───────────────────────────────────

export const BRIEFING_SYSTEM = `You write the daily briefing for Home Helper, the user's personal life app (food and water, activity and sleep, kitchen, shopping, money, chores, calendar, weather). It's read on the home screen and in the morning notification.

Write exactly 3 nudges for the day you're asked about. Each one is a single short line the user can act on that day, ideally joining two parts of their life: a dinner that uses food expiring soon, a workout in a free gap before rain, a cheaper week because they shop once, a chore that has slipped for weeks fitting a quiet evening, water before a hot afternoon. Use patterns from the last weeks when they help ("you spend more in weeks without a big shop", "your runs go better after 7 hours of sleep"), with the number.

Rules:
- Don't restate what the app already shows (how many events, the weather) unless you add what to do about it.
- Only use the data given; don't invent events, items or numbers. If there's little data, give simple, useful habits for that day.
- Respect their diet and what you remember about them. No medical advice.
- Warm and brief, second person, no greetings. Use their currency and 24-hour times.`;

export const REVIEW_SYSTEM = `You write the Sunday weekly review for Home Helper, the user's personal life app (food and water, activity and sleep, kitchen, shopping, money, chores, calendar, weather).

Look back at the week (budget pace, nutrition and water gaps, chores that slipped, activity and sleep) and suggest a plan for next week.

The review: short, specific and kind, with numbers from the data. Each part is one or two short sentences. If a part has no data, say so in a few words.

The plan for next week: only changes worth making, usually 4 to 15:
- Events in real free time from the calendar for workouts, chores that slipped and errands, with emoji titles. Don't double-book.
- Meals for busy days or to use food that expires soon, respecting their diet and budget.
- Shopping: only ingredients they're missing for those meals.
- training_days only if moving workout days clearly helps (e.g. away from busy days).
Use dates from next week only. Only use the data given; don't invent events, items or numbers.`;

function sections(input: ProactiveInput, extra: string[] = []): string {
  return [
    input.memory ? `<memory>\n${input.memory}\n</memory>` : '',
    `<today>\n${input.today}\n</today>`,
    `<calendar_next_7_days>\n${input.calendarWeek}\n</calendar_next_7_days>`,
    `<forecast>\n${input.forecast}\n</forecast>`,
    ...extra,
    `<history>\nMoney:\n${input.history.money}\n\nFood:\n${input.history.food}\n\nActivity:\n${input.history.activity}\n\nChores:\n${input.history.chores}\n</history>`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function briefingTurn(input: ProactiveInput, target: { date: string; tomorrow: boolean }): string {
  const day = longDate(fromDateKey(target.date));
  return `${sections(input)}\n\nWrite the 3 nudges for ${target.tomorrow ? `tomorrow, ${day}. It's the evening before: use tomorrow's calendar and forecast, and today's data for what's in the kitchen and what's slipping.` : `today, ${day}.`}`;
}

export function reviewTurn(input: ProactiveInput, week: string, now: Date = new Date()): string {
  const nextMonday = addDays(week, 7);
  const extra = [
    input.foodWeek ? `<food_week>\n${input.foodWeek}\n</food_week>` : '',
    input.kitchen ? `<kitchen>\n${input.kitchen}\n</kitchen>` : '',
    input.chores ? `<chores>\n${input.chores}\n</chores>` : '',
  ];
  const lastDay = addDays(nextMonday, 6);
  return `${sections(input, extra)}\n\nReview the week of ${week} to ${addDays(week, 6)} (today is ${longDate(now)}), then plan next week: ${nextMonday} to ${lastDay}.`;
}

// ── Calls ────────────────────────────────────────────────────────────────

async function structured<T extends z.ZodType>(apiKey: string, system: string, turn: string, schema: T, effort: 'low' | 'medium'): Promise<z.infer<T>> {
  // The user's own key, sent only to the Anthropic API.
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  try {
    const message = await client.beta.messages.parse({
      model: 'claude-opus-5-5',
      max_tokens: effort === 'low' ? 8000 : 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort, format: betaZodOutputFormat(schema) },
      cache_control: { type: 'ephemeral' },
      system,
      messages: [{ role: 'user', content: turn }],
    });
    if (message.stop_reason === 'refusal') throw new AssistantError("Couldn't write this one today.");
    if (!message.parsed_output) throw new AssistantError(message.stop_reason === 'max_tokens' ? 'That got too long. Try again.' : 'The answer came back in the wrong shape. Try again.');
    return message.parsed_output as z.infer<T>;
  } catch (error) {
    throw friendlyError(error);
  }
}

/** One cheap call (low effort) for the day's 3 nudges. */
export async function makeBriefing(apiKey: string, input: ProactiveInput, now: Date = new Date()): Promise<DailyBriefing> {
  const target = briefingTarget(now);
  const out = await structured(apiKey, BRIEFING_SYSTEM, briefingTurn(input, target), NudgesSchema, 'low');
  return { date: target.date, nudges: out.nudges.filter((n) => n.text.trim()).slice(0, 3) };
}

export async function makeReview(apiKey: string, input: ProactiveInput, week: string, now: Date = new Date()): Promise<WeeklyReview> {
  const out = await structured(apiKey, REVIEW_SYSTEM, reviewTurn(input, week, now), ReviewSchema, 'medium');
  const { plan, ...review } = out;
  return { week, ...review, plan: plan.changes.length ? makePlan({ ...plan, changes: plan.changes.slice(0, 40) }) : null };
}

/** The nudges as lines for the morning notification. */
export const nudgeLines = (b: DailyBriefing) => b.nudges.map((n) => `${n.emoji} ${n.text}`);
