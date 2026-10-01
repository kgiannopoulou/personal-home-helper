import { describe, expect, jest, test } from '@jest/globals';

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
import { lastNDays } from '../../src/shared/dates';
import {
  minusMinutes,
  minutesUntilNextWorkout,
  periodSummary,
  reviewInsights,
  sleepHours,
  workoutFuelAdvice,
  workoutKcal,
} from '../../src/modules/activity/lib/fitness';
import { DEFAULT_STATE } from '../../src/modules/activity/lib/storage';
import type { AppState } from '../../src/modules/activity/lib/types';

describe('calculations', () => {
  test('MET calories', () => {
    // 9.8 MET × 60 kg × 0.5 h
    expect(workoutKcal('run', 'moderate', 30, 60)).toBe(294);
  });

  test('sleep crosses midnight', () => {
    expect(sleepHours('23:30', '07:00')).toBe(7.5);
    expect(sleepHours('01:00', '09:15')).toBe(8.3);
  });

  test('reminder times wrap to the previous day', () => {
    expect(minusMinutes(2, '18:00', 90)).toEqual({ weekday: 2, hour: 16, minute: 30 });
    expect(minusMinutes(1, '00:30', 90)).toEqual({ weekday: 7, hour: 23, minute: 0 });
  });
});

describe('workout fuel advice', () => {
  test('changes with time to the workout', () => {
    expect(workoutFuelAdvice(240, 'omnivore').title).toBe('Plan your fuel');
    expect(workoutFuelAdvice(120, 'omnivore').eat).toMatch(/light snack/);
    expect(workoutFuelAdvice(45, 'omnivore').drink).toMatch(/150–250 ml/);
    expect(workoutFuelAdvice(5, 'omnivore').eat).toMatch(/Don't eat/);
    expect(workoutFuelAdvice(-60, 'omnivore').title).toBe('After your workout');
  });

  test('ideas respect diet', () => {
    const vegan = workoutFuelAdvice(-60, 'vegan').ideas.join(' ').toLowerCase();
    expect(vegan).not.toMatch(/chicken|salmon|yogurt|(?<!soy )milk|omelette|egg/);
  });

  test('finds the next scheduled workout', () => {
    // Wed 30 Sep 2026 10:00; training on Wednesdays (4) at 18:00
    const now = new Date(2026, 8, 30, 10, 0);
    const schedule = { enabled: true, weekdays: [4], time: '18:00', type: 'gym' as const };
    expect(minutesUntilNextWorkout(schedule, now)).toBe(480);
    // Thursday → next Wednesday
    expect(minutesUntilNextWorkout(schedule, new Date(2026, 9, 1, 10, 0))).toBe(6 * 1440 + 480);
    expect(minutesUntilNextWorkout({ ...schedule, enabled: false }, now)).toBeNull();
  });
});

describe('reviews', () => {
  test('weekly summary and insights', () => {
    const end = new Date(2026, 8, 30);
    const days = lastNDays(7, end);
    const state: AppState = {
      ...DEFAULT_STATE,
      profile: { name: 'A', weightKg: 70, diet: 'omnivore', stepGoal: 8000, sleepGoalHours: 8 },
      workouts: [
        { id: '1', date: days[1], type: 'gym', minutes: 60, intensity: 'moderate', kcal: 350, source: 'manual' },
        { id: '2', date: days[4], type: 'run', minutes: 100, intensity: 'easy', kcal: 800, source: 'manual' },
        { id: '3', date: '2026-01-01', type: 'run', minutes: 30, intensity: 'easy', kcal: 200, source: 'manual' },
      ],
      steps: { [days[5]]: 6000, [days[6]]: 10000 },
      sleep: [
        { id: 's', date: days[6], bedtime: '00:00', wake: '06:00', hours: 6, quality: 3 },
        { id: 't', date: days[5], bedtime: '23:00', wake: '07:00', hours: 8, quality: 4 },
      ],
      weights: [
        { id: 'a', date: days[0], kg: 71 },
        { id: 'b', date: days[6], kg: 70.4 },
      ],
    };
    const s = periodSummary(state, 7, end);
    expect(s.workouts).toBe(2);
    expect(s.activeMinutes).toBe(160);
    expect(s.avgSteps).toBe(8000);
    expect(s.daysOverStepGoal).toBe(1);
    expect(s.avgSleep).toBe(7);
    expect(s.weightChange).toBe(-0.6);
    const text = reviewInsights(s, state.profile, 7).join('\n');
    expect(text).toMatch(/160 active min\/week/);
    expect(text).toMatch(/below your 8 h goal/);
  });
});
