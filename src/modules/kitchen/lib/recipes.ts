import { normalizeName } from '../../../shared/homeCore';
import { expiryStatus } from './inventory';
import type { InventoryItem } from './types';

export interface Recipe {
  name: string;
  emoji: string;
  minutes: number;
  /** Main ingredients, matched loosely against inventory names */
  ingredients: string[];
}

export const RECIPES: Recipe[] = [
  { name: 'Spinach omelette + toast', emoji: '🍳', minutes: 10, ingredients: ['egg', 'spinach', 'bread'] },
  { name: 'Cheese & tomato omelette', emoji: '🍳', minutes: 10, ingredients: ['egg', 'cheese', 'tomato'] },
  { name: 'Shakshuka', emoji: '🍅', minutes: 25, ingredients: ['egg', 'tomato', 'pepper', 'onion'] },
  { name: 'Chicken, rice & veg', emoji: '🍗', minutes: 30, ingredients: ['chicken', 'rice', 'broccoli'] },
  { name: 'Chicken wrap', emoji: '🌯', minutes: 15, ingredients: ['chicken', 'tortilla', 'lettuce', 'tomato'] },
  { name: 'Chicken stir-fry', emoji: '🥘', minutes: 20, ingredients: ['chicken', 'pepper', 'noodle', 'carrot'] },
  { name: 'Spaghetti bolognese', emoji: '🍝', minutes: 35, ingredients: ['mince', 'pasta', 'tomato', 'onion'] },
  { name: 'Pasta with spinach & feta', emoji: '🍝', minutes: 15, ingredients: ['pasta', 'spinach', 'feta'] },
  { name: 'Creamy mushroom pasta', emoji: '🍄', minutes: 20, ingredients: ['pasta', 'mushroom', 'cream'] },
  { name: 'Salmon with potatoes & greens', emoji: '🐟', minutes: 30, ingredients: ['salmon', 'potato', 'broccoli'] },
  { name: 'Tuna pasta salad', emoji: '🥗', minutes: 15, ingredients: ['tuna', 'pasta', 'cucumber', 'tomato'] },
  { name: 'Greek salad', emoji: '🥗', minutes: 10, ingredients: ['tomato', 'cucumber', 'feta', 'onion'] },
  { name: 'Lentil curry', emoji: '🍛', minutes: 35, ingredients: ['lentil', 'onion', 'tomato', 'rice'] },
  { name: 'Chickpea & spinach stew', emoji: '🍲', minutes: 25, ingredients: ['chickpea', 'spinach', 'tomato', 'onion'] },
  { name: 'Tofu veggie stir-fry', emoji: '🥢', minutes: 20, ingredients: ['tofu', 'pepper', 'broccoli', 'rice'] },
  { name: 'Veggie soup', emoji: '🥣', minutes: 30, ingredients: ['carrot', 'potato', 'onion', 'courgette'] },
  { name: 'Banana pancakes', emoji: '🥞', minutes: 15, ingredients: ['banana', 'egg', 'oats'] },
  { name: 'Yogurt, berries & granola', emoji: '🫐', minutes: 3, ingredients: ['yogurt', 'berries', 'granola'] },
  { name: 'Smoothie', emoji: '🥤', minutes: 5, ingredients: ['banana', 'milk', 'berries'] },
  { name: 'Avocado toast with egg', emoji: '🥑', minutes: 10, ingredients: ['avocado', 'bread', 'egg'] },
  { name: 'Grilled cheese & tomato soup', emoji: '🥪', minutes: 20, ingredients: ['bread', 'cheese', 'tomato'] },
  { name: 'Baked potato with beans & cheese', emoji: '🥔', minutes: 45, ingredients: ['potato', 'bean', 'cheese'] },
];

const has = (item: InventoryItem, ingredient: string) => {
  // Substring match so "blueberries" counts as berries and "cherry tomatoes" as tomato.
  return normalizeName(item.name).includes(normalizeName(ingredient));
};

export interface RecipeSuggestion {
  recipe: Recipe;
  /** Ingredients that should be used soon */
  usesSoon: string[];
  have: string[];
  missing: string[];
}

/**
 * Recipes that use up food expiring in the next few days, preferring recipes
 * where you already have most of the ingredients.
 */
export function suggestRecipes(items: InventoryItem[], today?: string, limit = 3): RecipeSuggestion[] {
  const available = items.filter((i) => i.level !== 'empty' && expiryStatus(i, today)?.status !== 'expired');
  const soon = available.filter((i) => {
    const s = expiryStatus(i, today);
    return s !== null && s.daysLeft <= 3;
  });
  if (soon.length === 0) return [];

  const scored = RECIPES.map((recipe) => {
    const usesSoon = recipe.ingredients.filter((ing) => soon.some((i) => has(i, ing)));
    const have = recipe.ingredients.filter((ing) => available.some((i) => has(i, ing)));
    const missing = recipe.ingredients.filter((ing) => !have.includes(ing));
    return { recipe, usesSoon, have, missing, score: usesSoon.length * 3 + have.length - missing.length * 1.5 };
  })
    .filter((s) => s.usesSoon.length > 0)
    .sort((a, b) => b.score - a.score || a.recipe.minutes - b.recipe.minutes);

  return scored.slice(0, limit).map(({ score: _score, ...rest }) => rest);
}
