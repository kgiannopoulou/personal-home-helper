import { lastNDays } from '../../../shared/dates';
import type { AppState, Diet, Intensity, WorkoutType } from './types';

/** MET values (Compendium of Physical Activities, rounded). */
const MET: Record<WorkoutType, Record<Intensity, number>> = {
  run: { easy: 7, moderate: 9.8, hard: 11.5 },
  walk: { easy: 2.8, moderate: 3.5, hard: 4.3 },
  gym: { easy: 3.5, moderate: 5, hard: 6 },
  cycle: { easy: 5.8, moderate: 7.5, hard: 10 },
  swim: { easy: 5.8, moderate: 7, hard: 9.8 },
  hiit: { easy: 6, moderate: 8, hard: 10 },
  yoga: { easy: 2.5, moderate: 3, hard: 4 },
  other: { easy: 3, moderate: 4.5, hard: 6 },
};

export const WORKOUT_LABEL: Record<WorkoutType, string> = {
  run: '🏃 Run',
  walk: '🚶 Walk',
  gym: '🏋️ Gym',
  cycle: '🚴 Cycle',
  swim: '🏊 Swim',
  hiit: '🔥 HIIT',
  yoga: '🧘 Yoga',
  other: '⚡ Other',
};

export function workoutKcal(type: WorkoutType, intensity: Intensity, minutes: number, weightKg: number): number {
  return Math.round(MET[type][intensity] * weightKg * (minutes / 60));
}

/** Rough energy from walking: ~0.5 kcal per kg of body weight per 1000 steps. */
export function stepsKcal(steps: number, weightKg: number): number {
  return Math.round((steps / 1000) * weightKg * 0.5);
}

/** Hours between bedtime and wake time (HH:MM), crossing midnight if needed. */
export function sleepHours(bedtime: string, wake: string): number {
  const toMin = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + (m || 0);
  };
  let diff = toMin(wake) - toMin(bedtime);
  if (diff <= 0) diff += 24 * 60;
  return Math.round((diff / 60) * 10) / 10;
}

export function isTime(t: string): boolean {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
  return !!m && Number(m[1]) < 24 && Number(m[2]) < 60;
}

/** Shift a weekday (1 = Sunday … 7 = Saturday) and HH:MM back by `minutes`, wrapping to the previous day. */
export function minusMinutes(weekday: number, time: string, minutes: number): { weekday: number; hour: number; minute: number } {
  const [h, m] = time.split(':').map(Number);
  let total = h * 60 + m - minutes;
  let day = weekday;
  if (total < 0) {
    total += 24 * 60;
    day = day === 1 ? 7 : day - 1;
  }
  return { weekday: day, hour: Math.floor(total / 60), minute: total % 60 };
}

export interface Advice {
  title: string;
  eat: string;
  drink: string;
  ideas: string[];
}

const IDEAS: Record<'meal' | 'snack' | 'quick' | 'recovery', Record<Diet, string[]>> = {
  meal: {
    omnivore: ['Chicken, rice and vegetables', 'Pasta with tuna and tomato sauce', 'Eggs on wholegrain toast'],
    vegetarian: ['Eggs on wholegrain toast', 'Pasta with tomato sauce and feta', 'Rice bowl with halloumi and veg'],
    vegan: ['Tofu, rice and vegetables', 'Lentil pasta with tomato sauce', 'Oats with banana and peanut butter'],
  },
  snack: {
    omnivore: ['Banana', 'Greek yogurt with honey', 'Toast with peanut butter'],
    vegetarian: ['Banana', 'Greek yogurt with honey', 'Toast with peanut butter'],
    vegan: ['Banana', 'Toast with peanut butter', 'A handful of dates'],
  },
  quick: {
    omnivore: ['Half a banana', 'A few dates or a rice cake'],
    vegetarian: ['Half a banana', 'A few dates or a rice cake'],
    vegan: ['Half a banana', 'A few dates or a rice cake'],
  },
  recovery: {
    omnivore: ['Chicken wrap with salad', 'Milk or a protein shake + banana', 'Salmon, potatoes and greens'],
    vegetarian: ['Greek yogurt with oats and berries', 'Omelette with toast', 'Chocolate milk + banana'],
    vegan: ['Soy milk smoothie with banana and oats', 'Tofu stir-fry with rice', 'Hummus wrap with chickpeas'],
  },
};

/**
 * What to eat and drink around a workout. Based on common sports-nutrition
 * guidance: a meal 2–3 h before, a small carb snack 30–60 min before, and
 * steady sips rather than big gulps of water just before training.
 */
export function workoutFuelAdvice(minutesUntil: number, diet: Diet): Advice {
  if (minutesUntil < -15) {
    return {
      title: 'After your workout',
      eat: 'Within 1–2 hours, have protein plus carbs to recover and refuel.',
      drink: 'Drink around 500 ml of water over the next hour, more if you sweated a lot.',
      ideas: IDEAS.recovery[diet],
    };
  }
  if (minutesUntil <= 15) {
    return {
      title: 'Workout time',
      eat: "Don't eat now: food this close to training can cause stomach cramps.",
      drink: 'A few sips of water are fine. Avoid gulping a lot right before you start.',
      ideas: [],
    };
  }
  if (minutesUntil <= 60) {
    return {
      title: `Workout in ${Math.round(minutesUntil)} min`,
      eat: 'Only if you are hungry: a small, easy-to-digest carb snack. Skip fatty or high-fibre food.',
      drink: 'Sip about 150–250 ml of water in the next 15 minutes.',
      ideas: IDEAS.quick[diet],
    };
  }
  if (minutesUntil <= 180) {
    return {
      title: `Workout in ${Math.round(minutesUntil / 60 * 10) / 10} h`,
      eat: 'Have a light snack with carbs and a little protein for energy.',
      drink: 'Drink a glass or two of water (≈ 400–600 ml) between now and training.',
      ideas: IDEAS.snack[diet],
    };
  }
  return {
    title: 'Plan your fuel',
    eat: 'Eat a normal balanced meal with carbs and protein 2–3 hours before training.',
    drink: 'Stay hydrated through the day. Pale-yellow urine is a good sign.',
    ideas: IDEAS.meal[diet],
  };
}

/** Minutes from now until today's (or the next) scheduled workout, or null if none. */
export function minutesUntilNextWorkout(schedule: AppState['schedule'], now: Date = new Date()): number | null {
  if (!schedule.enabled || schedule.weekdays.length === 0 || !isTime(schedule.time)) return null;
  const [h, m] = schedule.time.split(':').map(Number);
  let best: number | null = null;
  for (let offset = 0; offset < 8; offset++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, h, m);
    if (!schedule.weekdays.includes(d.getDay() + 1)) continue;
    const diff = (d.getTime() - now.getTime()) / 60000;
    // Keep showing today's session for 2 h afterwards so recovery advice appears.
    if (diff < -120) continue;
    best = diff;
    break;
  }
  return best;
}

export interface PeriodSummary {
  days: string[];
  workouts: number;
  activeMinutes: number;
  workoutKcal: number;
  avgSteps: number;
  daysOverStepGoal: number;
  avgSleep: number | null;
  sleepNights: number;
  weightChange: number | null;
  latestWeight: number | null;
  coachRuns: number;
}

export function periodSummary(state: AppState, days: number, end: Date = new Date()): PeriodSummary {
  const keys = lastNDays(days, end);
  const inRange = new Set(keys);
  const workouts = state.workouts.filter((w) => inRange.has(w.date));
  const stepDays = keys.map((k) => state.steps[k] ?? 0).filter((s) => s > 0);
  const sleep = state.sleep.filter((s) => inRange.has(s.date));
  const weights = [...state.weights].filter((w) => inRange.has(w.date)).sort((a, b) => a.date.localeCompare(b.date));
  return {
    days: keys,
    workouts: workouts.length,
    activeMinutes: workouts.reduce((s, w) => s + w.minutes, 0),
    workoutKcal: workouts.reduce((s, w) => s + w.kcal, 0),
    avgSteps: stepDays.length ? Math.round(stepDays.reduce((a, b) => a + b, 0) / stepDays.length) : 0,
    daysOverStepGoal: state.profile ? stepDays.filter((s) => s >= state.profile!.stepGoal).length : 0,
    avgSleep: sleep.length ? Math.round((sleep.reduce((s, x) => s + x.hours, 0) / sleep.length) * 10) / 10 : null,
    sleepNights: sleep.length,
    weightChange: weights.length >= 2 ? Math.round((weights[weights.length - 1].kg - weights[0].kg) * 10) / 10 : null,
    latestWeight: weights.length ? weights[weights.length - 1].kg : null,
    coachRuns: state.coach.sessions.filter((s) => inRange.has(s.date)).length,
  };
}

/** Friendly one-liners for the weekly/monthly review. */
export function reviewInsights(s: PeriodSummary, profile: AppState['profile'], periodDays: number): string[] {
  const out: string[] = [];
  const weeks = periodDays / 7;
  // WHO: at least 150 min of moderate activity per week
  const perWeek = s.activeMinutes / weeks;
  if (perWeek >= 150) out.push(`💪 ${Math.round(perWeek)} active min/week, above the 150 min WHO recommendation.`);
  else if (s.workouts > 0) out.push(`⏱️ ${Math.round(perWeek)} active min/week. Aim for 150 by adding one or two short sessions.`);
  else out.push('🚀 No workouts logged yet. Even a 20-minute walk counts!');
  if (profile && s.avgSteps > 0) {
    out.push(
      s.avgSteps >= profile.stepGoal
        ? `👟 Averaging ${s.avgSteps.toLocaleString()} steps, above your goal.`
        : `👟 Averaging ${s.avgSteps.toLocaleString()} steps, ${(profile.stepGoal - s.avgSteps).toLocaleString()} short of your goal. A 15-minute walk is ~1,500 steps.`,
    );
  }
  if (profile && s.avgSleep !== null) {
    out.push(
      s.avgSleep >= profile.sleepGoalHours
        ? `😴 Sleeping ${s.avgSleep} h on average. Nice.`
        : `😴 Sleeping ${s.avgSleep} h on average, below your ${profile.sleepGoalHours} h goal. Try going to bed 30 min earlier.`,
    );
  }
  if (s.weightChange !== null) {
    out.push(`⚖️ Weight ${s.weightChange > 0 ? '+' : ''}${s.weightChange} kg over this period.`);
  }
  return out;
}
