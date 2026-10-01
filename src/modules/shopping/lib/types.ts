import type { Category } from '../../../shared/homeCore';

export interface ListItem {
  id: string;
  name: string;
  category: Category;
  quantity?: string;
  /** Price you entered for this item, overrides the estimate */
  price?: number;
  checked: boolean;
  addedAt: string;
  source: 'manual' | 'inventory';
}

export interface Trip {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  total: number;
  store?: string;
  itemCount: number;
  source: 'manual' | 'receipt';
}

export interface Settings {
  weeklyBudget: number;
  monthlyBudget: number;
  currency: string;
}

export interface AppState {
  items: ListItem[];
  trips: Trip[];
  /** Last price paid per normalized item name */
  prices: Record<string, number>;
  /** How often each item has been added, for quick-add suggestions */
  history: Record<string, { name: string; count: number }>;
  settings: Settings;
}
