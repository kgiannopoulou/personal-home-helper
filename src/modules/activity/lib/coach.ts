import type { CoachSession, CoachState, Feeling } from './types';

export interface Level {
  /** Seconds running per interval */
  run: number;
  /** Seconds walking between intervals */
  walk: number;
  reps: number;
}

/**
 * A couch-to-5K style plan: from 1-minute jogs to 30 minutes of continuous running.
 * Every session also has a 5-minute walking warm-up and cool-down.
 */
export const PLAN: Level[] = [
  { run: 60, walk: 90, reps: 8 },
  { run: 90, walk: 90, reps: 7 },
  { run: 120, walk: 90, reps: 6 },
  { run: 180, walk: 90, reps: 5 },
  { run: 300, walk: 120, reps: 4 },
  { run: 480, walk: 120, reps: 3 },
  { run: 600, walk: 90, reps: 3 },
  { run: 900, walk: 120, reps: 2 },
  { run: 1200, walk: 0, reps: 1 },
  { run: 1500, walk: 0, reps: 1 },
  { run: 1800, walk: 0, reps: 1 },
];

export const MAX_LEVEL = PLAN.length;
export const WARMUP = 300;
export const COOLDOWN = 300;
/** Good sessions needed at a level before moving up */
export const SESSIONS_TO_ADVANCE = 2;

export type SegmentKind = 'warmup' | 'run' | 'walk' | 'cooldown';

export interface Segment {
  kind: SegmentKind;
  seconds: number;
  /** 1-based rep number for run/walk segments */
  rep?: number;
}

export function clampLevel(level: number): number {
  return Math.min(MAX_LEVEL, Math.max(1, Math.round(level)));
}

export function segmentsFor(level: number): Segment[] {
  const { run, walk, reps } = PLAN[clampLevel(level) - 1];
  const segments: Segment[] = [{ kind: 'warmup', seconds: WARMUP }];
  for (let rep = 1; rep <= reps; rep++) {
    segments.push({ kind: 'run', seconds: run, rep });
    // No walk after the last run: the cool-down takes over.
    if (walk > 0 && rep < reps) segments.push({ kind: 'walk', seconds: walk, rep });
  }
  segments.push({ kind: 'cooldown', seconds: COOLDOWN });
  return segments;
}

export function totalSeconds(segments: Segment[]): number {
  return segments.reduce((s, x) => s + x.seconds, 0);
}

export function runSeconds(segments: Segment[]): number {
  return segments.filter((s) => s.kind === 'run').reduce((s, x) => s + x.seconds, 0);
}

const fmt = (sec: number) => (sec % 60 === 0 ? `${sec / 60} min` : `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')} min`);

export function describeLevel(level: number): string {
  const { run, walk, reps } = PLAN[clampLevel(level) - 1];
  if (reps === 1) return `Run ${fmt(run)} without stopping`;
  return `Run ${fmt(run)}, walk ${fmt(walk)} × ${reps}`;
}

export function formatClock(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Where we are in a session after `elapsed` seconds. */
export function positionAt(segments: Segment[], elapsed: number): { index: number; remaining: number; done: boolean } {
  let t = elapsed;
  for (let i = 0; i < segments.length; i++) {
    if (t < segments[i].seconds) return { index: i, remaining: segments[i].seconds - t, done: false };
    t -= segments[i].seconds;
  }
  return { index: segments.length - 1, remaining: 0, done: true };
}

export interface Adaptation {
  level: number;
  message: string;
  /** Suggested rest days before the next run */
  restDays: number;
}

/**
 * Decides the next session from how this one went. The rules are deliberately
 * conservative: moving up needs repeated success, while struggling or pain
 * steps back straight away.
 */
export function adapt(state: CoachState, completed: boolean, feeling: Feeling): Adaptation {
  const level = state.level;
  if (feeling === 'pain') {
    return {
      level: clampLevel(level - 1),
      restDays: 2,
      message:
        'Rest for at least two days and go back a step. If the pain is sharp or still there after resting, see a doctor or physio before running again.',
    };
  }
  if (!completed || feeling === 'too_hard') {
    return {
      level: clampLevel(level - 1),
      restDays: 1,
      message:
        level > 1
          ? "No problem, that's how training works. Next time we'll go back one step and build up again."
          : "No problem. We'll repeat this session. Try a slower jog: you should still be able to talk.",
    };
  }
  if (feeling === 'hard') {
    return { level, restDays: 1, message: "Good effort! We'll repeat this level until it feels comfortable." };
  }
  if (level >= MAX_LEVEL) {
    return { level, restDays: 1, message: '🏆 You can run 30 minutes non-stop, which is roughly a 5K. Keep it up!' };
  }
  if (feeling === 'too_easy') {
    const next = clampLevel(level + 2);
    return { level: next, restDays: 1, message: `Great! Skipping ahead to: ${describeLevel(next)}.` };
  }
  // just_right: move up after enough good sessions at this level (counting this one)
  const good = goodSessionsAtLevel(state.sessions, level) + 1;
  if (good >= SESSIONS_TO_ADVANCE) {
    return { level: level + 1, restDays: 1, message: `Level up! Next: ${describeLevel(level + 1)}.` };
  }
  return {
    level,
    restDays: 1,
    message: `Nice! One more good session at this level and you move up.`,
  };
}

/** Good sessions at `level` since the last time the level changed. */
export function goodSessionsAtLevel(sessions: CoachSession[], level: number): number {
  let count = 0;
  for (let i = sessions.length - 1; i >= 0; i--) {
    const s = sessions[i];
    if (s.level !== level) break;
    if (s.completed && (s.feeling === 'just_right' || s.feeling === 'too_easy')) count++;
    else break;
  }
  return count;
}

/** Days until the next run is due (0 = today), leaving rest days after the last session. */
export function daysUntilNextRun(sessions: CoachSession[], today: Date = new Date()): number {
  const last = sessions[sessions.length - 1];
  if (!last) return 0;
  const [y, m, d] = last.date.split('-').map(Number);
  const daysSince = Math.round(
    (new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() - new Date(y, m - 1, d).getTime()) / 86400000,
  );
  const needed = last.feeling === 'pain' ? 2 : 1;
  return Math.max(0, needed + 1 - daysSince);
}
