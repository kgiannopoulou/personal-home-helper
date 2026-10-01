export type Diet = 'omnivore' | 'vegetarian' | 'vegan';
export type WorkoutType = 'run' | 'walk' | 'gym' | 'cycle' | 'swim' | 'hiit' | 'yoga' | 'other';
export type Intensity = 'easy' | 'moderate' | 'hard';
/** How a coached run felt, which decides the next session. */
export type Feeling = 'too_easy' | 'just_right' | 'hard' | 'too_hard' | 'pain';

export interface Profile {
  name: string;
  weightKg: number;
  diet: Diet;
  stepGoal: number;
  sleepGoalHours: number;
}

export interface Workout {
  id: string;
  date: string;
  type: WorkoutType;
  minutes: number;
  intensity: Intensity;
  kcal: number;
  source: 'manual' | 'coach';
  notes?: string;
}

export interface SleepEntry {
  id: string;
  /** The morning you woke up, YYYY-MM-DD */
  date: string;
  bedtime: string;
  wake: string;
  hours: number;
  /** 1 (awful) … 5 (great) */
  quality: number;
}

export interface WeightEntry {
  id: string;
  date: string;
  kg: number;
}

export interface CoachSession {
  id: string;
  date: string;
  level: number;
  completed: boolean;
  feeling: Feeling;
}

export interface CoachState {
  /** 1-based level in the running plan */
  level: number;
  sessions: CoachSession[];
}

export interface TrainingSchedule {
  enabled: boolean;
  /** 1 = Sunday … 7 = Saturday (matches expo-notifications) */
  weekdays: number[];
  time: string;
  type: WorkoutType;
}

export interface AppState {
  profile: Profile | null;
  workouts: Workout[];
  sleep: SleepEntry[];
  weights: WeightEntry[];
  /** Steps per day, YYYY-MM-DD → steps */
  steps: Record<string, number>;
  coach: CoachState;
  schedule: TrainingSchedule;
}
