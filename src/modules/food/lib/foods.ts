import type { Diet, Nutrients } from './types';

export type FoodGroup = 'protein' | 'dairy' | 'legume' | 'grain' | 'fruit' | 'vegetable' | 'fat' | 'drink' | 'other';

export interface Food {
  name: string;
  /** Values per 100 g (or 100 ml for drinks) */
  per100: Nutrients;
  /** A typical portion in grams */
  serving: number;
  servingLabel: string;
  /** The least restrictive diet this food requires */
  diet: Diet;
  group: FoodGroup;
}

const f = (
  name: string,
  [kcal, protein, carbs, fat, fiber]: [number, number, number, number, number],
  serving: number,
  servingLabel: string,
  diet: Diet,
  group: FoodGroup,
): Food => ({ name, per100: { kcal, protein, carbs, fat, fiber }, serving, servingLabel, diet, group });

// Approximate reference values (USDA / UK CoFID). Good enough for daily tracking, not medical use.
export const FOODS: Food[] = [
  f('Egg', [155, 13, 1.1, 11, 0], 50, '1 egg', 'vegetarian', 'protein'),
  f('Chicken breast (cooked)', [165, 31, 0, 3.6, 0], 150, '1 breast', 'omnivore', 'protein'),
  f('Turkey breast (cooked)', [135, 30, 0, 1, 0], 150, '1 portion', 'omnivore', 'protein'),
  f('Salmon (cooked)', [206, 22, 0, 12, 0], 150, '1 fillet', 'omnivore', 'protein'),
  f('Tuna (canned in water)', [116, 26, 0, 1, 0], 100, '1 small can', 'omnivore', 'protein'),
  f('Sardines (canned)', [208, 25, 0, 11, 0], 90, '1 can', 'omnivore', 'protein'),
  f('Beef mince 10% fat (cooked)', [217, 26, 0, 12, 0], 125, '1 portion', 'omnivore', 'protein'),
  f('Tofu (firm)', [144, 17, 3, 9, 2], 150, '½ block', 'vegan', 'protein'),
  f('Greek yogurt (2%)', [73, 10, 3.9, 2, 0], 170, '1 pot', 'vegetarian', 'dairy'),
  f('Skyr', [63, 11, 4, 0.2, 0], 150, '1 pot', 'vegetarian', 'dairy'),
  f('Cottage cheese', [98, 11, 3.4, 4.3, 0], 150, '½ tub', 'vegetarian', 'dairy'),
  f('Milk (semi-skimmed)', [50, 3.4, 4.8, 1.8, 0], 250, '1 glass', 'vegetarian', 'dairy'),
  f('Cheddar cheese', [403, 25, 1.3, 33, 0], 30, '1 slice', 'vegetarian', 'dairy'),
  f('Feta cheese', [264, 14, 4, 21, 0], 40, '1 portion', 'vegetarian', 'dairy'),
  f('Halloumi', [321, 21, 2.6, 25, 0], 50, '2 slices', 'vegetarian', 'dairy'),
  f('Soy milk (unsweetened)', [33, 2.9, 1.7, 1.6, 0.4], 250, '1 glass', 'vegan', 'drink'),
  f('Oat milk', [46, 1, 6.7, 1.5, 0.8], 250, '1 glass', 'vegan', 'drink'),
  f('Lentils (cooked)', [116, 9, 20, 0.4, 7.9], 180, '1 cup', 'vegan', 'legume'),
  f('Chickpeas (cooked)', [164, 8.9, 27, 2.6, 7.6], 150, '½ can', 'vegan', 'legume'),
  f('Black beans (cooked)', [132, 8.9, 24, 0.5, 8.7], 150, '½ can', 'vegan', 'legume'),
  f('Kidney beans (cooked)', [127, 8.7, 22.8, 0.5, 6.4], 150, '½ can', 'vegan', 'legume'),
  f('Edamame', [121, 12, 8.9, 5.2, 5.2], 150, '1 bowl', 'vegan', 'legume'),
  f('Hummus', [166, 7.9, 14, 9.6, 6], 50, '2 tbsp', 'vegan', 'legume'),
  f('Peanut butter', [588, 25, 20, 50, 6], 30, '2 tbsp', 'vegan', 'fat'),
  f('Almonds', [579, 21, 22, 50, 12.5], 30, '1 handful', 'vegan', 'fat'),
  f('Pumpkin seeds', [559, 30, 11, 49, 6], 30, '1 handful', 'vegan', 'fat'),
  f('Chia seeds', [486, 17, 42, 31, 34], 15, '1 tbsp', 'vegan', 'fat'),
  f('Avocado', [160, 2, 8.5, 15, 6.7], 100, '½ avocado', 'vegan', 'fat'),
  f('Olive oil', [884, 0, 0, 100, 0], 10, '1 tbsp', 'vegan', 'fat'),
  f('Butter', [717, 0.9, 0.1, 81, 0], 10, '1 knob', 'vegetarian', 'fat'),
  f('Oats (dry)', [389, 17, 66, 7, 10.6], 50, '1 bowl', 'vegan', 'grain'),
  f('White rice (cooked)', [130, 2.7, 28, 0.3, 0.4], 180, '1 cup', 'vegan', 'grain'),
  f('Brown rice (cooked)', [112, 2.3, 24, 0.8, 1.8], 180, '1 cup', 'vegan', 'grain'),
  f('Pasta (cooked)', [158, 5.8, 31, 0.9, 1.8], 200, '1 plate', 'vegan', 'grain'),
  f('Quinoa (cooked)', [120, 4.4, 21, 1.9, 2.8], 180, '1 cup', 'vegan', 'grain'),
  f('Wholemeal bread', [247, 13, 41, 3.4, 7], 40, '1 slice', 'vegan', 'grain'),
  f('White bread', [265, 9, 49, 3.2, 2.7], 40, '1 slice', 'vegan', 'grain'),
  f('Potato (boiled)', [87, 1.9, 20, 0.1, 1.8], 200, '1 large', 'vegan', 'vegetable'),
  f('Sweet potato (baked)', [90, 2, 21, 0.2, 3.3], 200, '1 medium', 'vegan', 'vegetable'),
  f('Broccoli (cooked)', [35, 2.4, 7.2, 0.4, 3.3], 100, '1 portion', 'vegan', 'vegetable'),
  f('Spinach (raw)', [23, 2.9, 3.6, 0.4, 2.2], 60, '2 handfuls', 'vegan', 'vegetable'),
  f('Carrot', [41, 0.9, 10, 0.2, 2.8], 80, '1 carrot', 'vegan', 'vegetable'),
  f('Tomato', [18, 0.9, 3.9, 0.2, 1.2], 120, '1 tomato', 'vegan', 'vegetable'),
  f('Mixed salad leaves', [17, 1.4, 3, 0.2, 1.5], 50, '1 bowl', 'vegan', 'vegetable'),
  f('Banana', [89, 1.1, 23, 0.3, 2.6], 120, '1 banana', 'vegan', 'fruit'),
  f('Apple', [52, 0.3, 14, 0.2, 2.4], 180, '1 apple', 'vegan', 'fruit'),
  f('Orange', [47, 0.9, 12, 0.1, 2.4], 150, '1 orange', 'vegan', 'fruit'),
  f('Blueberries', [57, 0.7, 14, 0.3, 2.4], 100, '1 cup', 'vegan', 'fruit'),
  f('Orange juice', [45, 0.7, 10, 0.2, 0.2], 250, '1 glass', 'vegan', 'drink'),
  f('Dark chocolate 70%', [598, 7.8, 46, 43, 11], 20, '2 squares', 'vegetarian', 'other'),
  f('Pizza margherita', [266, 11, 33, 10, 2.3], 300, '½ pizza', 'vegetarian', 'other'),
];

export function suitsDiet(foodDiet: Diet, userDiet: Diet): boolean {
  if (userDiet === 'omnivore') return true;
  if (userDiet === 'vegetarian') return foodDiet !== 'omnivore';
  return foodDiet === 'vegan';
}

export function searchFoods(query: string, diet: Diet): Food[] {
  const q = query.trim().toLowerCase();
  return FOODS.filter((food) => suitsDiet(food.diet, diet) && (!q || food.name.toLowerCase().includes(q)));
}

export function nutrientsFor(food: Food, grams: number): Nutrients {
  const k = grams / 100;
  const r = (n: number) => Math.round(n * k * 10) / 10;
  return {
    kcal: Math.round(food.per100.kcal * k),
    protein: r(food.per100.protein),
    carbs: r(food.per100.carbs),
    fat: r(food.per100.fat),
    fiber: r(food.per100.fiber),
  };
}
