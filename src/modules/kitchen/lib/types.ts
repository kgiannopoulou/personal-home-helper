import type { Category } from '../../../shared/homeCore';

export type Level = 'full' | 'half' | 'low' | 'empty';
export type Location = 'fridge' | 'freezer' | 'pantry' | 'bathroom' | 'cleaning' | 'other';

export interface InventoryItem {
  id: string;
  name: string;
  category: Category;
  location: Location;
  level: Level;
  quantity?: string;
  /** YYYY-MM-DD of the latest purchase */
  boughtAt: string;
  /** YYYY-MM-DD, estimated or entered */
  expiresAt?: string;
  price?: number;
  /** Every purchase date, oldest first, used to predict when it runs out */
  purchases: string[];
}

export interface Settings {
  /** Put items on the to-buy list automatically when they run low or empty */
  autoAddLow: boolean;
  expiryReminders: boolean;
}

export interface AppState {
  items: InventoryItem[];
  /** Names waiting to be sent to the shopping list */
  toBuy: string[];
  settings: Settings;
}
