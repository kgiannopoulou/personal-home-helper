export type ExpenseCategory =
  | 'groceries'
  | 'household'
  | 'eating_out'
  | 'transport'
  | 'bills'
  | 'health'
  | 'fun'
  | 'shopping'
  | 'other';

export interface Expense {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  amount: number;
  category: ExpenseCategory;
  note?: string;
  source: 'manual' | 'shopping' | 'recurring';
  /** Set when created from a recurring bill, so each bill is added once per month */
  recurringId?: string;
}

/** A fixed cost that is added automatically every month (rent, phone, Netflix…). */
export interface Recurring {
  id: string;
  name: string;
  amount: number;
  category: ExpenseCategory;
  /** 1–28 */
  dayOfMonth: number;
}

/** Something on your wishlist that the app can suggest when you're under budget. */
export interface Reward {
  id: string;
  name: string;
  price: number;
}

/** An electric appliance whose running cost you want to know (heater, humidifier…). */
export interface Appliance {
  id: string;
  name: string;
  /** Power in kilowatts */
  kw: number;
  hoursPerDay: number;
  /** Days per month it's used (a heater might only run on 20 days) */
  daysPerMonth: number;
}

export interface Settings {
  /** Total monthly spending budget, 0 = none */
  monthlyBudget: number;
  /** Weekly groceries + household budget, 0 = none */
  weeklyGroceries: number;
  categoryBudgets: Partial<Record<ExpenseCategory, number>>;
  currency: string;
  /** Electricity price per kWh */
  kwhPrice: number;
}

export interface AppState {
  expenses: Expense[];
  recurring: Recurring[];
  rewards: Reward[];
  appliances: Appliance[];
  settings: Settings;
}
