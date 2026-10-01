/**
 * Shared "Personal Home Helper" foundation.
 * This file is identical in kitchen-inventory and smart-shopping-list so both
 * apps agree on categories and on the link format they use to talk to each other.
 */

export type Category = 'food' | 'drinks' | 'cleaning' | 'bathroom' | 'home' | 'pet' | 'other';

export const CATEGORIES: Category[] = ['food', 'drinks', 'cleaning', 'bathroom', 'home', 'pet', 'other'];

export const CATEGORY_LABEL: Record<Category, string> = {
  food: '🥦 Food',
  drinks: '🥤 Drinks',
  cleaning: '🧽 Cleaning',
  bathroom: '🧴 Bathroom',
  home: '🏠 Home',
  pet: '🐕 Pet',
  other: '📦 Other',
};

// Keyword lists are checked in order, so more specific categories come first
// ("dog food" is pet, "dish soap" is cleaning, "soap" alone is bathroom).
const KEYWORDS: [Category, string[]][] = [
  ['pet', ['dog', 'cat', 'cat food', 'cat litter', 'litter', 'pet', 'kibble', 'bird seed', 'fish food']],
  [
    'cleaning',
    ['dish soap', 'washing up', 'dishwasher', 'detergent', 'softener', 'bleach', 'cleaner', 'sponge', 'wipes', 'spray', 'descaler', 'rubber gloves', 'mop', 'laundry', 'stain'],
  ],
  [
    'bathroom',
    ['toilet paper', 'toilet roll', 'shampoo', 'conditioner', 'toothpaste', 'toothbrush', 'soap', 'shower gel', 'deodorant', 'razor', 'floss', 'tissues', 'cotton', 'sanitary', 'tampons', 'pads', 'lotion', 'sunscreen', 'mouthwash'],
  ],
  [
    'home',
    ['light bulb', 'bulb', 'batteries', 'battery', 'trash bags', 'bin bags', 'rubbish bags', 'foil', 'cling film', 'baking paper', 'paper towel', 'kitchen roll', 'candles', 'matches', 'napkins', 'zip bags', 'freezer bags'],
  ],
  [
    'drinks',
    ['water', 'juice', 'coffee', 'tea', 'soda', 'cola', 'beer', 'wine', 'lemonade', 'sparkling', 'kombucha'],
  ],
  [
    'food',
    ['milk', 'egg', 'bread', 'butter', 'cheese', 'yogurt', 'yoghurt', 'chicken', 'beef', 'pork', 'fish', 'salmon', 'tuna', 'ham', 'rice', 'pasta', 'flour', 'sugar', 'salt', 'oil', 'banana', 'apple', 'orange', 'tomato', 'potato', 'onion', 'garlic', 'spinach', 'lettuce', 'carrot', 'pepper', 'cucumber', 'broccoli', 'lentil', 'bean', 'chickpea', 'tofu', 'oats', 'cereal', 'honey', 'jam', 'nuts', 'chocolate', 'biscuit', 'cookie', 'crisps', 'fruit', 'veg', 'vegetable', 'melon', 'watermelon', 'berries', 'avocado', 'lemon', 'mushroom', 'cream', 'feta', 'mince', 'sausage', 'steak', 'lamb', 'turkey', 'bacon', 'prawn', 'shrimp', 'grape', 'pear', 'peach', 'corn', 'peas', 'zucchini', 'courgette', 'aubergine', 'granola', 'tortilla', 'wrap', 'bagel', 'noodle', 'sauce', 'spice', 'herb', 'yeast', 'frozen', 'pizza', 'soup', 'hummus', 'peanut'],
  ],
];

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const PATTERNS: [Category, RegExp][] = KEYWORDS.map(([category, words]) => [
  category,
  // Whole words with an optional plural, so "tea" doesn't match "steak" and "eggs" matches "egg".
  new RegExp(`\\b(${words.map(escapeRegExp).join('|')})(s|es)?\\b`),
]);

export function categorize(name: string): Category {
  const n = name.toLowerCase().trim();
  for (const [category, pattern] of PATTERNS) {
    if (pattern.test(n)) return category;
  }
  return 'other';
}

/** Case- and plural-insensitive key for matching item names ("Eggs" ≈ "egg"). */
export function normalizeName(name: string): string {
  const n = name.toLowerCase().trim().replace(/\s+/g, ' ');
  if (n.endsWith('ies') && n.length > 4) return n.slice(0, -3) + 'y';
  if (n.endsWith('oes')) return n.slice(0, -2);
  if (n.endsWith('s') && !n.endsWith('ss') && n.length > 3) return n.slice(0, -1);
  return n;
}

/** URL scheme of the Smart Shopping List app. */
export const SHOPPING_SCHEME = 'smartshopping';

export interface ShoppingImport {
  items: string[];
  /** Money spent on a shopping trip (e.g. from a scanned receipt) */
  spend?: number;
  store?: string;
  /** YYYY-MM-DD */
  date?: string;
}

/** Builds a link that opens Smart Shopping List and imports items and/or a spend. */
export function shoppingLink(data: ShoppingImport): string {
  const params: string[] = [];
  if (data.items.length) params.push(`items=${encodeURIComponent(data.items.join('|'))}`);
  if (data.spend !== undefined) params.push(`spend=${data.spend.toFixed(2)}`);
  if (data.store) params.push(`store=${encodeURIComponent(data.store)}`);
  if (data.date) params.push(`date=${data.date}`);
  return `${SHOPPING_SCHEME}://add?${params.join('&')}`;
}

/** Parses the query params of an import link (as given by Expo Router's useLocalSearchParams). */
export function parseShoppingImport(params: Record<string, string | string[] | undefined>): ShoppingImport {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const items = (one(params.items) ?? '')
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 100);
  const spendRaw = Number(one(params.spend));
  const date = one(params.date);
  return {
    items,
    spend: Number.isFinite(spendRaw) && spendRaw > 0 && spendRaw < 100000 ? Math.round(spendRaw * 100) / 100 : undefined,
    store: one(params.store)?.slice(0, 60) || undefined,
    date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined,
  };
}

/** Plain-text list for sharing via WhatsApp, notes, etc. */
export function shoppingText(items: { name: string; category: Category }[]): string {
  const lines: string[] = ['🛒 Shopping list'];
  for (const c of CATEGORIES) {
    const group = items.filter((i) => i.category === c);
    if (!group.length) continue;
    lines.push('', CATEGORY_LABEL[c]);
    for (const i of group) lines.push(`• ${i.name}`);
  }
  return lines.join('\n');
}
