import { describe, expect, test } from '@jest/globals';
import { lastNDays, toDateKey } from '../../src/shared/dates';
import { FOODS, nutrientsFor, searchFoods, suitsDiet } from '../../src/modules/food/lib/foods';
import { bmr, dailyTargets, suggestFoods, suggestNextMeal, sumNutrients, weekSummary } from '../../src/modules/food/lib/nutrition';
import { waterReminderHours } from '../../src/modules/food/lib/schedule';
import type { FoodEntry, Profile, WaterEntry } from '../../src/modules/food/lib/types';

const maria: Profile = {
  name: 'Maria',
  sex: 'female',
  age: 30,
  heightCm: 165,
  weightKg: 60,
  activity: 'light',
  goal: 'maintain',
  diet: 'vegetarian',
};

const food = (date: string, n: Partial<FoodEntry>): FoodEntry => ({
  id: Math.random().toString(),
  date,
  time: `${date}T12:00:00.000Z`,
  name: 'x',
  meal: 'lunch',
  source: 'custom',
  kcal: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  fiber: 0,
  ...n,
});

describe('targets', () => {
  test('Mifflin-St Jeor BMR', () => {
    // 10*60 + 6.25*165 - 5*30 - 161 = 1320.25
    expect(bmr(maria)).toBe(1320);
    expect(bmr({ ...maria, sex: 'male' })).toBe(1486);
  });

  test('daily targets scale with activity, goal and weight', () => {
    const t = dailyTargets(maria);
    expect(t.kcal).toBe(Math.round(1320 * 1.375));
    expect(t.protein).toBe(72); // 1.2 g/kg
    expect(t.waterMl).toBe(2100); // 35 ml/kg
    expect(dailyTargets({ ...maria, goal: 'lose' }).kcal).toBe(t.kcal - 500);
    expect(dailyTargets({ ...maria, goal: 'gain' }).kcal).toBe(t.kcal + 300);
  });

  test('weight loss never drops below a safe floor', () => {
    expect(dailyTargets({ ...maria, weightKg: 40, heightCm: 150, age: 70, activity: 'sedentary', goal: 'lose' }).kcal).toBe(1200);
  });

  test('vegans get a higher protein target', () => {
    expect(dailyTargets({ ...maria, diet: 'vegan' }).protein).toBeGreaterThan(dailyTargets(maria).protein);
  });
});

describe('foods', () => {
  test('diet filtering', () => {
    expect(suitsDiet('omnivore', 'vegetarian')).toBe(false);
    expect(suitsDiet('vegetarian', 'vegan')).toBe(false);
    expect(suitsDiet('vegan', 'vegan')).toBe(true);
    expect(searchFoods('', 'vegan').every((f) => f.diet === 'vegan')).toBe(true);
    expect(searchFoods('chicken', 'vegetarian')).toHaveLength(0);
  });

  test('nutrients scale by grams', () => {
    const egg = FOODS.find((f) => f.name === 'Egg')!;
    expect(nutrientsFor(egg, 100).kcal).toBe(155);
    expect(nutrientsFor(egg, 50).protein).toBe(6.5);
  });
});

describe('week summary', () => {
  const end = new Date(2026, 8, 30); // 30 Sep 2026
  const days = lastNDays(7, end);

  test('lastNDays is inclusive and ordered', () => {
    expect(days).toHaveLength(7);
    expect(days[6]).toBe('2026-09-30');
    expect(days[0]).toBe('2026-09-24');
  });

  test('averages only count logged days and flags low protein', () => {
    const targets = dailyTargets(maria);
    const foods = [
      food(days[5], { kcal: targets.kcal, protein: 30, fiber: targets.fiber }),
      food(days[6], { kcal: targets.kcal, protein: 40, fiber: targets.fiber }),
    ];
    const water: WaterEntry[] = [{ id: 'w', date: days[6], time: '', ml: 2100, drink: 'water' }];
    const week = weekSummary(foods, water, targets, end);
    expect(week.loggedDays).toBe(2);
    expect(week.average.protein).toBe(35);
    expect(week.gaps.map((g) => g.key)).toEqual(['protein']);
  });

  test('no gaps are reported with no data', () => {
    expect(weekSummary([], [], dailyTargets(maria), end).gaps).toEqual([]);
  });

  test('suggests protein foods that fit the diet', () => {
    const targets = dailyTargets(maria);
    const week = weekSummary([food(days[6], { kcal: 500, protein: 5, fiber: 20 })], [], targets, end);
    const advice = suggestNextMeal(sumNutrients([{ kcal: 500, protein: 5, carbs: 0, fat: 0, fiber: 20 }]), targets, week, 'vegetarian');
    expect(advice.focus).toBe('protein');
    expect(advice.suggestions.length).toBeGreaterThan(0);
    for (const s of advice.suggestions) expect(suitsDiet(s.food.diet, 'vegetarian')).toBe(true);
  });

  test('suggestions are varied and vegan-safe', () => {
    const picks = suggestFoods('protein', 'vegan');
    expect(new Set(picks.map((p) => p.food.group)).size).toBe(picks.length);
    expect(picks.every((p) => p.food.diet === 'vegan')).toBe(true);
  });
});

describe('misc', () => {
  test('water reminder hours', () => {
    expect(waterReminderHours({ wakeHour: 8, sleepHour: 22, waterEveryHours: 2 })).toEqual([9, 11, 13, 15, 17, 19, 21]);
  });

  test('date keys are local', () => {
    expect(toDateKey(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });
});
