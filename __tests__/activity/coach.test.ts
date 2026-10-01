import { describe, expect, test } from '@jest/globals';
import { adapt, daysUntilNextRun, describeLevel, goodSessionsAtLevel, MAX_LEVEL, positionAt, segmentsFor, totalSeconds } from '../../src/modules/activity/lib/coach';
import type { CoachSession, CoachState, Feeling } from '../../src/modules/activity/lib/types';

const session = (level: number, feeling: Feeling, completed = true, date = '2026-09-28'): CoachSession => ({
  id: Math.random().toString(),
  date,
  level,
  completed,
  feeling,
});

describe('plan', () => {
  test('level 1 is run 1 min / walk 1:30 × 8 with warm-up and cool-down', () => {
    const segs = segmentsFor(1);
    expect(segs[0]).toEqual({ kind: 'warmup', seconds: 300 });
    expect(segs[segs.length - 1]).toEqual({ kind: 'cooldown', seconds: 300 });
    expect(segs.filter((s) => s.kind === 'run')).toHaveLength(8);
    expect(segs.filter((s) => s.kind === 'walk')).toHaveLength(7);
    expect(totalSeconds(segs)).toBe(600 + 8 * 60 + 7 * 90);
  });

  test('final level is 30 min continuous', () => {
    expect(describeLevel(MAX_LEVEL)).toBe('Run 30 min without stopping');
    expect(segmentsFor(MAX_LEVEL).map((s) => s.kind)).toEqual(['warmup', 'run', 'cooldown']);
  });

  test('positionAt walks through segments', () => {
    const segs = segmentsFor(1);
    expect(positionAt(segs, 0)).toEqual({ index: 0, remaining: 300, done: false });
    expect(positionAt(segs, 310)).toEqual({ index: 1, remaining: 50, done: false });
    expect(positionAt(segs, totalSeconds(segs)).done).toBe(true);
  });
});

describe('adaptation', () => {
  const at = (level: number, sessions: CoachSession[] = []): CoachState => ({ level, sessions });

  test('needs two good sessions to move up', () => {
    expect(adapt(at(3), true, 'just_right').level).toBe(3);
    expect(adapt(at(3, [session(3, 'just_right')]), true, 'just_right').level).toBe(4);
  });

  test('a hard session resets the streak', () => {
    const sessions = [session(3, 'just_right'), session(3, 'hard')];
    expect(goodSessionsAtLevel(sessions, 3)).toBe(0);
    expect(adapt(at(3, sessions), true, 'just_right').level).toBe(3);
  });

  test('too easy skips ahead, too hard and pain step back', () => {
    expect(adapt(at(3), true, 'too_easy').level).toBe(5);
    expect(adapt(at(3), true, 'hard').level).toBe(3);
    expect(adapt(at(3), false, 'too_hard').level).toBe(2);
    const pain = adapt(at(3), true, 'pain');
    expect(pain.level).toBe(2);
    expect(pain.restDays).toBe(2);
  });

  test('never goes below level 1 or above the max', () => {
    expect(adapt(at(1), false, 'too_hard').level).toBe(1);
    expect(adapt(at(MAX_LEVEL), true, 'too_easy').level).toBe(MAX_LEVEL);
    expect(adapt(at(MAX_LEVEL - 1), true, 'too_easy').level).toBe(MAX_LEVEL);
  });

  test('rest days between runs', () => {
    const ran = [session(2, 'just_right', true, '2026-09-28')];
    expect(daysUntilNextRun(ran, new Date(2026, 8, 28))).toBe(2);
    expect(daysUntilNextRun(ran, new Date(2026, 8, 29))).toBe(1);
    expect(daysUntilNextRun(ran, new Date(2026, 8, 30))).toBe(0);
    expect(daysUntilNextRun([session(2, 'pain', true, '2026-09-28')], new Date(2026, 8, 30))).toBe(1);
    expect(daysUntilNextRun([])).toBe(0);
  });
});
