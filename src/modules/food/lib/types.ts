export type Diet = 'omnivore' | 'vegetarian' | 'vegan';
export type Sex = 'female' | 'male';
export type Goal = 'lose' | 'maintain' | 'gain';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type Drink = 'water' | 'tea' | 'coffee' | 'other';

export interface Profile {
  name: string;
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activity: ActivityLevel;
  goal: Goal;
  diet: Diet;
}

export interface Nutrients {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export type Targets = Nutrients & { waterMl: number };

export interface FoodEntry extends Nutrients {
  id: string;
  /** Local calendar day, YYYY-MM-DD */
  date: string;
  /** ISO timestamp */
  time: string;
  name: string;
  grams?: number;
  meal: Meal;
  source: 'database' | 'custom' | 'ai';
}

export interface WaterEntry {
  id: string;
  date: string;
  time: string;
  ml: number;
  drink: Drink;
}

export interface ReminderSettings {
  enabled: boolean;
  waterEveryHours: number;
  wakeHour: number;
  sleepHour: number;
  /** HH:MM per meal */
  meals: Record<Exclude<Meal, 'snack'>, string>;
}

export interface AppState {
  profile: Profile | null;
  foods: FoodEntry[];
  water: WaterEntry[];
  reminders: ReminderSettings;
}
