import { FOODS, nutrientsFor, suitsDiet, type Food } from './foods';
import { lastNDays } from '../../../shared/dates';
import type { ActivityLevel, Diet, FoodEntry, Nutrients, Profile, Targets, WaterEntry } from './types';

const ACTIVITY_FACTOR: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export const ZERO: Nutrients = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
const KEYS = Object.keys(ZERO) as (keyof Nutrients)[];

/** Basal metabolic rate, Mifflin-St Jeor equation. */
export function bmr(p: Pick<Profile, 'sex' | 'weightKg' | 'heightCm' | 'age'>): number {
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age;
  return Math.round(base + (p.sex === 'male' ? 5 : -161));
}

export function dailyTargets(p: Profile): Targets {
  const tdee = bmr(p) * ACTIVITY_FACTOR[p.activity];
  const floor = p.sex === 'male' ? 1500 : 1200;
  const kcal = Math.round(
    p.goal === 'lose' ? Math.max(floor, tdee - 500) : p.goal === 'gain' ? tdee + 300 : tdee,
  );
  // Plant proteins are less digestible, so vegans get a ~10% higher protein target.
  const proteinPerKg = (p.goal === 'maintain' ? 1.2 : 1.6) * (p.diet === 'vegan' ? 1.1 : 1);
  const protein = Math.round(p.weightKg * proteinPerKg);
  const fat = Math.round((kcal * 0.3) / 9);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return {
    kcal,
    protein,
    carbs,
    fat,
    fiber: Math.round((kcal / 1000) * 14),
    waterMl: Math.round((p.weightKg * 35) / 50) * 50,
  };
}

export function sumNutrients(entries: Nutrients[]): Nutrients {
  const total = { ...ZERO };
  for (const e of entries) for (const k of KEYS) total[k] += e[k];
  for (const k of KEYS) total[k] = Math.round(total[k] * 10) / 10;
  return total;
}

export interface DaySummary {
  date: string;
  nutrients: Nutrients;
  waterMl: number;
  logged: boolean;
}

export type GapKey = keyof Nutrients | 'water';

export interface Gap {
  key: GapKey;
  direction: 'low' | 'high';
  /** Average as a fraction of target, e.g. 0.7 = 70% */
  ratio: number;
}

export interface WeekSummary {
  days: DaySummary[];
  average: Nutrients & { waterMl: number };
  loggedDays: number;
  gaps: Gap[];
}

export function daySummary(date: string, foods: FoodEntry[], water: WaterEntry[]): DaySummary {
  const dayFoods = foods.filter((f) => f.date === date);
  const dayWater = water.filter((w) => w.date === date);
  return {
    date,
    nutrients: sumNutrients(dayFoods),
    waterMl: dayWater.reduce((s, w) => s + w.ml, 0),
    logged: dayFoods.length > 0,
  };
}

/**
 * Summarises the last 7 days. Averages only count days where food was logged,
 * so a forgotten day doesn't look like a fast.
 */
export function weekSummary(
  foods: FoodEntry[],
  water: WaterEntry[],
  targets: Targets,
  end: Date = new Date(),
): WeekSummary {
  const days = lastNDays(7, end).map((d) => daySummary(d, foods, water));
  const logged = days.filter((d) => d.logged);
  const n = Math.max(1, logged.length);
  const total = sumNutrients(logged.map((d) => d.nutrients));
  const average = { ...ZERO, waterMl: 0 };
  for (const k of KEYS) average[k] = Math.round((total[k] / n) * 10) / 10;
  const waterDays = days.filter((d) => d.waterMl > 0);
  average.waterMl = Math.round(waterDays.reduce((s, d) => s + d.waterMl, 0) / Math.max(1, waterDays.length));

  const gaps: Gap[] = [];
  if (logged.length > 0) {
    for (const key of ['protein', 'fiber'] as const) {
      const ratio = average[key] / targets[key];
      if (ratio < 0.85) gaps.push({ key, direction: 'low', ratio });
    }
    const kcalRatio = average.kcal / targets.kcal;
    if (kcalRatio < 0.85) gaps.push({ key: 'kcal', direction: 'low', ratio: kcalRatio });
    if (kcalRatio > 1.15) gaps.push({ key: 'kcal', direction: 'high', ratio: kcalRatio });
  }
  if (waterDays.length > 0) {
    const ratio = average.waterMl / targets.waterMl;
    if (ratio < 0.85) gaps.push({ key: 'water', direction: 'low', ratio });
  }
  return { days, average, loggedDays: logged.length, gaps };
}

export interface FoodSuggestion {
  food: Food;
  grams: number;
  nutrients: Nutrients;
}

/** Foods richest in `nutrient` per calorie, filtered by diet, with a portion that fits `kcalBudget`. */
export function suggestFoods(
  nutrient: 'protein' | 'fiber',
  diet: Diet,
  kcalBudget = Infinity,
  count = 3,
): FoodSuggestion[] {
  const density = (food: Food) => food.per100[nutrient] / Math.max(1, food.per100.kcal);
  const seenGroups = new Set<string>();
  const picks: FoodSuggestion[] = [];
  for (const food of FOODS.filter((x) => suitsDiet(x.diet, diet)).sort((a, b) => density(b) - density(a))) {
    if (picks.length >= count) break;
    // Variety: at most one pick per food group.
    if (seenGroups.has(food.group)) continue;
    const nutrients = nutrientsFor(food, food.serving);
    if (nutrients.kcal > kcalBudget || nutrients[nutrient] < 2) continue;
    seenGroups.add(food.group);
    picks.push({ food, grams: food.serving, nutrients });
  }
  return picks;
}

export interface MealAdvice {
  headline: string;
  reason: string;
  focus: 'protein' | 'fiber' | 'balanced' | 'light';
  suggestions: FoodSuggestion[];
}

/**
 * "What should I eat next?" Looks at what's left of today's targets and this
 * week's gaps, then picks foods that close the biggest gap.
 */
export function suggestNextMeal(today: Nutrients, targets: Targets, week: WeekSummary, diet: Diet): MealAdvice {
  const kcalLeft = targets.kcal - today.kcal;
  if (kcalLeft < 150) {
    return {
      headline: "You've hit today's energy target",
      reason: 'If you are still hungry, go for something light and high in fibre.',
      focus: 'light',
      suggestions: suggestFoods('fiber', diet, 150, 2),
    };
  }
  const proteinLeft = (targets.protein - today.protein) / targets.protein;
  const fiberLeft = (targets.fiber - today.fiber) / targets.fiber;
  const kcalLeftRatio = kcalLeft / targets.kcal;
  const weekLow = (k: GapKey) => week.gaps.some((g) => g.key === k && g.direction === 'low');

  let focus: MealAdvice['focus'] = 'balanced';
  let reason = 'You are on track today, so pick a balanced plate.';
  if (weekLow('protein') || proteinLeft > kcalLeftRatio + 0.1) {
    focus = 'protein';
    reason = weekLow('protein')
      ? 'Your protein has been low this week.'
      : `You still need about ${Math.round(targets.protein - today.protein)} g protein today.`;
  } else if (weekLow('fiber') || fiberLeft > kcalLeftRatio + 0.1) {
    focus = 'fiber';
    reason = weekLow('fiber')
      ? 'Your fibre has been low this week.'
      : `You still need about ${Math.round(targets.fiber - today.fiber)} g fibre today.`;
  }
  const nutrient = focus === 'fiber' ? 'fiber' : 'protein';
  const perMealBudget = Math.min(kcalLeft, targets.kcal * 0.4);
  return {
    headline:
      focus === 'protein' ? 'Add more protein' : focus === 'fiber' ? 'Add more fibre' : 'Balanced meal',
    reason,
    focus,
    suggestions: suggestFoods(nutrient, diet, perMealBudget / 2),
  };
}
