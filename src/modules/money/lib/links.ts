import { parseShoppingImport } from '../../../shared/homeCore';
import { EXPENSE_CATEGORIES } from './budget';
import type { ExpenseCategory } from './types';

/** URL scheme of this app. */
export const MONEY_SCHEME = 'moneybudget';

export interface MoneyImport {
  amount: number;
  store?: string;
  date?: string;
  category: ExpenseCategory;
}

/**
 * Parses moneybudget://add?spend=23.40&store=Lidl&date=2026-10-01[&category=household].
 * Uses the same spend/store/date params as the Smart Shopping List link, so the other
 * apps can send a receipt or finished shopping trip here with the same builder.
 */
export function parseMoneyImport(params: Record<string, string | string[] | undefined>): MoneyImport | null {
  const { spend, store, date } = parseShoppingImport(params);
  if (spend === undefined) return null;
  const raw = Array.isArray(params.category) ? params.category[0] : params.category;
  const category = EXPENSE_CATEGORIES.includes(raw as ExpenseCategory) ? (raw as ExpenseCategory) : 'groceries';
  return { amount: spend, store, date, category };
}
