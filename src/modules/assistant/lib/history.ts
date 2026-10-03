import type { AppState as ActivityState, Feeling } from '../../activity/lib/types';
import { dueInfo, frequencyLabel } from '../../chores/lib/chores';
import type { AppState as ChoresState } from '../../chores/lib/types';
import { dailyTargets } from '../../food/lib/nutrition';
import type { AppState as FoodState } from '../../food/lib/types';
import type { AppState as KitchenState } from '../../kitchen/lib/types';
import { byCategory, daysInMonth, EXPENSE_LABEL, sum, weekStart } from '../../money/lib/budget';
import type { AppState as MoneyState, Expense, ExpenseCategory } from '../../money/lib/types';
import type { AppState as ShoppingState } from '../../shopping/lib/types';
import { fromDateKey, lastNDays, toDateKey } from '../../../shared/dates';
import type { HistoryModule } from './catalog';

/** Every module's saved state, as the history look-up needs it. */
export interface HistoryData {
  money: MoneyState;
  food: FoodState;
  activity: ActivityState;
  chores: ChoresState;
  shopping: ShoppingState;
  kitchen: KitchenState;
}

// Fixed English names: the phone's locale would make the data ambiguous for the model.
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const r = Math.round;
const r1 = (n: number) => Math.round(n * 10) / 10;
const total = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const avg = (xs: number[]) => (xs.length ? total(xs) / xs.length : null);
/** "+40%" / "−12%": how much bigger a is than b. */
const change = (a: number, b: number) => {
  const p = r((a / b - 1) * 100);
  return `${p >= 0 ? '+' : '−'}${Math.abs(p)}%`;
};
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const weekday = (key: string) => fromDateKey(key).getDay();

interface Period {
  label: string;
  days: string[];
  /** Every day of the week or month is inside the window */
  full: boolean;
}

/** The window split into Monday weeks, or calendar months for windows over 16 weeks. */
export function periods(keys: string[]): Period[] {
  const byMonth = keys.length > 112;
  const groups = new Map<string, string[]>();
  for (const k of keys) {
    const p = byMonth ? k.slice(0, 7) : toDateKey(weekStart(fromDateKey(k)));
    groups.set(p, [...(groups.get(p) ?? []), k]);
  }
  return [...groups].map(([p, days]) => {
    const full = days.length === (byMonth ? daysInMonth(p) : 7);
    return { label: `${byMonth ? p : `week of ${p}`}${full ? '' : ' (part)'}`, days, full };
  });
}

/** Most frequent values, as "Saturday (4), Wednesday (2)". */
function top(values: string[], n: number): string {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([v, c]) => `${v} (${c})`)
    .join(', ');
}

function percentile(xs: number[], p: number): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
}

// ── Money ────────────────────────────────────────────────────────────────

/** Categories of a set of expenses, biggest first: "Groceries €60.00, Eating out €30.00". */
function categoryList(ex: Expense[], c: string, n = 9): string {
  return Object.entries(byCategory(ex))
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k, v]) => `${EXPENSE_LABEL[k as ExpenseCategory]} ${c}${v.toFixed(2)}`)
    .join(', ');
}

/** A single groceries expense this big counts as a "big shop". */
export function bigShopThreshold(state: MoneyState, groceries: number[]): number {
  if (state.settings.weeklyGroceries > 0) return r(state.settings.weeklyGroceries * 0.5);
  return groceries.length ? Math.max(30, r(percentile(groceries, 0.9) * 0.5)) : 30;
}

export function moneyHistory(state: MoneyState, keys: string[]): string {
  const c = state.settings.currency;
  const inWindow = new Set(keys);
  const ex = state.expenses.filter((e) => inWindow.has(e.date));
  if (!ex.length) return `No expenses logged in the last ${keys.length} days.`;
  const perWeek = (n: number) => `${c}${((n / keys.length) * 7).toFixed(2)}`;
  const lines: string[] = [];

  const all = sum(ex);
  lines.push(`Spent ${c}${all.toFixed(2)} in ${plural(ex.length, 'expense')}, about ${perWeek(all)} a week.`);
  lines.push(
    `By category (total, per week): ${Object.entries(byCategory(ex))
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${EXPENSE_LABEL[k as ExpenseCategory]} ${c}${v.toFixed(2)} (${perWeek(v)})`)
      .join(', ')}.`,
  );

  // The same number of days just before, to explain "why am I over budget?".
  const before = new Set(lastNDays(keys.length, new Date(fromDateKey(keys[0]).getTime() - 864e5)));
  const prev = state.expenses.filter((e) => before.has(e.date));
  if (prev.length) {
    const now = byCategory(ex);
    const then = byCategory(prev);
    const moves = (Object.keys(now) as ExpenseCategory[])
      .map((k) => ({ k, d: now[k] - then[k] }))
      .filter((m) => Math.abs(m.d) >= 1)
      .sort((a, b) => Math.abs(b.d) - Math.abs(a.d))
      .slice(0, 4)
      .map((m) => `${EXPENSE_LABEL[m.k]} ${m.d > 0 ? '+' : '−'}${c}${Math.abs(m.d).toFixed(2)}`);
    lines.push(`Versus the ${keys.length} days before (${c}${sum(prev).toFixed(2)}): ${change(all, sum(prev))}${moves.length ? `; biggest changes: ${moves.join(', ')}` : ''}.`);
  }

  const groceries = ex.filter((e) => e.category === 'groceries');
  const threshold = bigShopThreshold(state, groceries.map((e) => e.amount));
  const isBig = (e: Expense) => e.category === 'groceries' && e.amount >= threshold;

  const ps = periods(keys);
  lines.push('By period:');
  for (const p of ps) {
    const days = new Set(p.days);
    const pe = ex.filter((e) => days.has(e.date));
    const big = pe.filter(isBig);
    lines.push(
      `- ${p.label}: ${c}${sum(pe).toFixed(2)}${pe.length ? ` (${categoryList(pe, c, 3)})` : ''}${big.length ? ` [big shop ${big.map((b) => `${c}${b.amount.toFixed(2)}`).join(', ')}]` : ''}`,
    );
  }

  // Do weeks with a big grocery shop cost less day to day than weeks of small top-ups?
  const weeks = keys.length <= 112 ? ps.filter((p) => p.full) : [];
  if (weeks.length >= 4) {
    const stats = weeks.map((w) => {
      const days = new Set(w.days);
      const we = ex.filter((e) => days.has(e.date) && e.source !== 'recurring');
      const small = we.filter((e) => e.category === 'groceries' && !isBig(e));
      return {
        big: we.some(isBig),
        dayToDay: sum(we),
        withoutBig: sum(we.filter((e) => !isBig(e))),
        eatingOut: sum(we.filter((e) => e.category === 'eating_out')),
        topUps: sum(small),
        topUpCount: small.length,
      };
    });
    const withBig = stats.filter((s) => s.big);
    const without = stats.filter((s) => !s.big);
    if (withBig.length >= 2 && without.length >= 2) {
      const describe = (g: typeof stats) => {
        const a = (f: (s: (typeof stats)[number]) => number) => avg(g.map(f))!;
        return `${c}${a((s) => s.dayToDay).toFixed(2)} a week (${c}${a((s) => s.withoutBig).toFixed(2)} leaving out the big shop), eating out ${c}${a((s) => s.eatingOut).toFixed(2)}, small grocery top-ups ${c}${a((s) => s.topUps).toFixed(2)} in ${r1(a((s) => s.topUpCount))} trips`;
      };
      const a = avg(without.map((s) => s.dayToDay))!;
      const b = avg(withBig.map((s) => s.dayToDay))!;
      lines.push(
        `Big shop = one groceries expense of ${c}${threshold} or more. Full weeks with one (${withBig.length}): ${describe(withBig)}. Weeks without (${without.length}): ${describe(without)}.` +
          (b > 0 ? ` Weeks without a big shop cost ${change(a, b)} versus weeks with one (bills left out).` : ''),
      );
    }
  }

  const largest = [...ex]
    .filter((e) => e.source !== 'recurring')
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3)
    .map((e) => `${e.date} ${c}${e.amount.toFixed(2)} ${e.note ?? EXPENSE_LABEL[e.category]}`);
  if (largest.length) lines.push(`Largest one-off expenses: ${largest.join('; ')}.`);
  const byDay = ex.filter((e) => e.source !== 'recurring').map((e) => DAYS[weekday(e.date)]);
  if (byDay.length >= 5) lines.push(`Most spending days: ${top(byDay, 3)}.`);
  return lines.join('\n');
}

// ── Food & water ─────────────────────────────────────────────────────────

export function foodHistory(state: FoodState, keys: string[]): string {
  const inWindow = new Set(keys);
  const water = new Map<string, number>();
  for (const w of state.water) if (inWindow.has(w.date)) water.set(w.date, (water.get(w.date) ?? 0) + w.ml);
  const kcal = new Map<string, number>();
  const protein = new Map<string, number>();
  const fiber = new Map<string, number>();
  const foods = state.foods.filter((f) => inWindow.has(f.date));
  for (const f of foods) {
    kcal.set(f.date, (kcal.get(f.date) ?? 0) + f.kcal);
    protein.set(f.date, (protein.get(f.date) ?? 0) + f.protein);
    fiber.set(f.date, (fiber.get(f.date) ?? 0) + f.fiber);
  }
  if (!water.size && !foods.length) return `No food or water logged in the last ${keys.length} days.`;
  const targets = state.profile ? dailyTargets(state.profile) : null;
  const lines: string[] = [];
  const mean = (m: Map<string, number>, days = [...m.keys()]) => avg(days.filter((d) => m.has(d)).map((d) => m.get(d)!));

  if (water.size) {
    const hit = targets ? [...water.values()].filter((ml) => ml >= targets.waterMl).length : 0;
    lines.push(
      `Water: logged on ${water.size} of ${keys.length} days, ${r(mean(water)!)} ml a day on those days` +
        (targets ? ` (goal ${targets.waterMl} ml, reached on ${plural(hit, 'day')})` : '') +
        '.',
    );
  } else lines.push('Water: nothing logged.');
  if (kcal.size) {
    lines.push(
      `Food: logged on ${kcal.size} of ${keys.length} days. Daily average on those days: ${r(mean(kcal)!)} kcal, protein ${r(mean(protein)!)} g, fibre ${r(mean(fiber)!)} g` +
        (targets ? ` (targets ${targets.kcal} kcal, ${targets.protein} g, ${targets.fiber} g)` : ' (no profile, so no targets)') +
        '.',
    );
    lines.push(`Most logged: ${top(foods.map((f) => f.name), 6)}.`);
  } else lines.push('Food: nothing logged.');

  const weekend = keys.filter((k) => [0, 6].includes(weekday(k)));
  const weekdays = keys.filter((k) => ![0, 6].includes(weekday(k)));
  const pair = (m: Map<string, number>, unit: string) => {
    const a = mean(m, weekdays);
    const b = mean(m, weekend);
    return a !== null && b !== null ? `${r(a)} vs ${r(b)} ${unit}` : null;
  };
  const split = [pair(water, 'ml water'), pair(kcal, 'kcal')].filter(Boolean);
  if (split.length) lines.push(`Weekdays vs weekends: ${split.join(', ')}.`);

  lines.push('By period (daily averages on logged days):');
  for (const p of periods(keys)) {
    const w = mean(water, p.days);
    const k = mean(kcal, p.days);
    lines.push(`- ${p.label}: water ${w === null ? '–' : `${r(w)} ml`}, food ${k === null ? '–' : `${r(k)} kcal, ${r(mean(protein, p.days)!)} g protein`}`);
  }
  return lines.join('\n');
}

// ── Activity & sleep ─────────────────────────────────────────────────────

const GOOD: Feeling[] = ['too_easy', 'just_right'];

export function activityHistory(state: ActivityState, keys: string[]): string {
  const inWindow = new Set(keys);
  const steps = keys.filter((k) => (state.steps[k] ?? 0) > 0);
  const sleep = state.sleep.filter((s) => inWindow.has(s.date)).sort((a, b) => a.date.localeCompare(b.date));
  const workouts = state.workouts.filter((w) => inWindow.has(w.date));
  const runs = state.coach.sessions.filter((s) => inWindow.has(s.date));
  if (!steps.length && !sleep.length && !workouts.length && !runs.length) return `No steps, sleep or workouts logged in the last ${keys.length} days.`;
  const lines: string[] = [];
  const stepGoal = state.profile?.stepGoal;
  const sleepGoal = state.profile?.sleepGoalHours ?? 7;

  if (steps.length) {
    const values = steps.map((k) => state.steps[k]);
    lines.push(
      `Steps: ${r(avg(values)!)} a day on ${steps.length} tracked days` + (stepGoal ? `, goal ${stepGoal} reached on ${plural(values.filter((s) => s >= stepGoal).length, 'day')}` : '') + '.',
    );
  }
  if (sleep.length) {
    const half = Math.floor(sleep.length / 2);
    const trend =
      sleep.length >= 6 ? ` Earlier half ${r1(avg(sleep.slice(0, half).map((s) => s.hours))!)} h → recent half ${r1(avg(sleep.slice(half).map((s) => s.hours))!)} h.` : '';
    lines.push(
      `Sleep: ${r1(avg(sleep.map((s) => s.hours))!)} h a night over ${plural(sleep.length, 'night')}, quality ${r1(avg(sleep.map((s) => s.quality))!)}/5, under ${sleepGoal} h on ${plural(sleep.filter((s) => s.hours < sleepGoal).length, 'night')}.${trend}`,
    );
  }
  if (workouts.length) {
    lines.push(
      `Workouts: ${workouts.length} (${top(workouts.map((w) => w.type), 8)}), ${total(workouts.map((w) => w.minutes))} active min, about ${r1((workouts.length / keys.length) * 7)} a week. Usual days: ${top(workouts.map((w) => DAYS[weekday(w.date)]), 3)}.`,
    );
  }
  if (runs.length) lines.push(`Coached runs: ${runs.length}, felt: ${top(runs.map((s) => s.feeling.replace('_', ' ')), 5)}. Coach level now ${state.coach.level}.`);

  // How the day went after a good or a short night (a sleep entry's date is the morning after).
  if (sleep.length >= 4) {
    const describe = (nights: typeof sleep) => {
      const days = new Set(nights.map((s) => s.date));
      const st = nights.map((s) => state.steps[s.date] ?? 0).filter((s) => s > 0);
      const rs = runs.filter((s) => days.has(s.date));
      const parts = [`${plural(nights.length, 'night')}`];
      if (st.length) parts.push(`${r(avg(st)!)} steps next day`);
      if (rs.length) parts.push(`runs felt good ${rs.filter((s) => GOOD.includes(s.feeling)).length} of ${rs.length}`);
      parts.push(`${workouts.filter((w) => days.has(w.date)).length} workouts`);
      return parts.join(', ');
    };
    const good = sleep.filter((s) => s.hours >= sleepGoal);
    const short = sleep.filter((s) => s.hours < sleepGoal);
    if (good.length && short.length) lines.push(`After ${sleepGoal}+ h sleep: ${describe(good)}. After less: ${describe(short)}.`);
  }

  const weights = state.weights.filter((w) => inWindow.has(w.date)).sort((a, b) => a.date.localeCompare(b.date));
  if (weights.length >= 2) lines.push(`Weight: ${weights[0].kg} kg (${weights[0].date}) → ${weights[weights.length - 1].kg} kg (${weights[weights.length - 1].date}).`);

  lines.push('By period:');
  for (const p of periods(keys)) {
    const days = new Set(p.days);
    const st = p.days.map((k) => state.steps[k] ?? 0).filter((s) => s > 0);
    const sl = sleep.filter((s) => days.has(s.date)).map((s) => s.hours);
    const wo = workouts.filter((w) => days.has(w.date));
    lines.push(
      `- ${p.label}: steps ${st.length ? r(avg(st)!) : '–'}, sleep ${sl.length ? `${r1(avg(sl)!)} h` : '–'}, ${plural(wo.length, 'workout')} (${total(wo.map((w) => w.minutes))} min)`,
    );
  }
  return lines.join('\n');
}

// ── Chores ───────────────────────────────────────────────────────────────

export function choresHistory(state: ChoresState, keys: string[], now: Date): string {
  const inWindow = new Set(keys);
  const comps = state.completions.filter((c) => inWindow.has(toDateKey(new Date(c.at))));
  const lines: string[] = [];
  const minutes = total(comps.map((c) => c.minutes));
  lines.push(`Done ${plural(comps.length, 'chore')} in the last ${keys.length} days, ${minutes} min in all, about ${r((minutes / keys.length) * 7)} min a week.`);

  const slipping: { ratio: number; text: string }[] = [];
  const onTrack: string[] = [];
  for (const t of state.tasks) {
    const done = comps.filter((c) => c.taskId === t.id).map((c) => new Date(c.at).getTime());
    // The last time before the window starts the first gap.
    const earlier = state.completions.filter((c) => c.taskId === t.id && !inWindow.has(toDateKey(new Date(c.at))) && toDateKey(new Date(c.at)) < keys[0]);
    const times = [...(earlier.length ? [Math.max(...earlier.map((c) => new Date(c.at).getTime()))] : []), ...done].sort((a, b) => a - b);
    const gaps = times.slice(1).map((x, i) => (x - times[i]) / 864e5);
    const gap = avg(gaps);
    const expected = keys.length / t.everyDays;
    const due = dueInfo(t, now);
    const late = expected >= 1 && done.length < expected * 0.7;
    const slow = gap !== null && gap > t.everyDays * 1.3;
    if (late || slow || due.status === 'overdue') {
      slipping.push({
        ratio: expected >= 1 ? done.length / expected : due.urgency > 1 ? 0.9 : 1,
        text:
          `${t.name} (${frequencyLabel(t.everyDays).toLowerCase()}): done ${done.length}×${expected >= 1 ? ` of ~${r(expected)} expected` : ''}` +
          (gap !== null ? `, every ~${r(gap)} days` : '') +
          (due.status === 'overdue' ? `, now ${plural(-due.dueIn, 'day')} overdue` : !t.lastDone ? ', never done' : ''),
      });
    } else if (done.length) onTrack.push(t.name);
  }
  slipping.sort((a, b) => a.ratio - b.ratio);
  lines.push(slipping.length ? `Slipping:\n${slipping.slice(0, 10).map((s) => `- ${s.text}`).join('\n')}${slipping.length > 10 ? `\n- and ${slipping.length - 10} more` : ''}` : 'Nothing is slipping.');
  if (onTrack.length) lines.push(`On track: ${onTrack.slice(0, 15).join(', ')}${onTrack.length > 15 ? ` and ${onTrack.length - 15} more` : ''}.`);

  if (comps.length >= 5) lines.push(`Chores usually done on: ${top(comps.map((c) => DAYS[new Date(c.at).getDay()]), 3)}.`);
  if (state.members.length > 1) {
    const by = state.members.map((m) => `${m.name} ${total(comps.filter((c) => c.by === m.id).map((c) => c.minutes))} min`);
    lines.push(`Who did them: ${by.join(', ')}.`);
  }
  if (comps.length) {
    lines.push('Minutes by period:');
    for (const p of periods(keys)) {
      const days = new Set(p.days);
      const pc = comps.filter((c) => days.has(toDateKey(new Date(c.at))));
      lines.push(`- ${p.label}: ${total(pc.map((c) => c.minutes))} min, ${plural(pc.length, 'chore')}`);
    }
  }
  return lines.join('\n');
}

// ── Shopping ─────────────────────────────────────────────────────────────

export function shoppingHistory(shopping: ShoppingState, kitchen: KitchenState, keys: string[]): string {
  const c = shopping.settings.currency;
  const inWindow = new Set(keys);
  const lines: string[] = [];

  const trips = shopping.trips.filter((t) => inWindow.has(t.date)).sort((a, b) => a.date.localeCompare(b.date));
  if (trips.length) {
    const biggest = trips.reduce((a, b) => (b.total > a.total ? b : a));
    const gaps = trips.slice(1).map((t, i) => (fromDateKey(t.date).getTime() - fromDateKey(trips[i].date).getTime()) / 864e5);
    lines.push(
      `Shopping trips: ${trips.length} (about ${r1((trips.length / keys.length) * 7)} a week${gaps.length ? `, every ~${r1(avg(gaps)!)} days` : ''}), ${c}${r(avg(trips.map((t) => t.total))!)} on average, biggest ${c}${biggest.total.toFixed(2)} on ${biggest.date}${biggest.store ? ` at ${biggest.store}` : ''}.`,
    );
    lines.push(`Usual days: ${top(trips.map((t) => DAYS[weekday(t.date)]), 3)}.`);
    const stores = trips.filter((t) => t.store).map((t) => t.store!);
    if (stores.length) lines.push(`Stores: ${top(stores, 4)}.`);
  } else lines.push(`No shopping trips logged in the last ${keys.length} days.`);

  // How often each item gets bought, from the kitchen's purchase dates.
  const items = kitchen.items
    .map((i) => {
      const all = [...i.purchases].sort();
      const recent = all.filter((d) => inWindow.has(d));
      const gaps = all.slice(1).map((d, n) => (fromDateKey(d).getTime() - fromDateKey(all[n]).getTime()) / 864e5);
      return { name: i.name, count: recent.length, gap: avg(gaps.slice(-6)), last: all[all.length - 1] };
    })
    .filter((i) => i.count > 0)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  if (items.length)
    lines.push(
      `Bought most often:\n${items
        .slice(0, 15)
        .map((i) => `- ${i.name}: ${i.count}×${i.gap !== null ? `, every ~${r(i.gap)} days` : ''}, last ${i.last}`)
        .join('\n')}`,
    );

  const added = Object.values(shopping.history)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
    .map((h) => `${h.name} (${h.count})`);
  if (added.length) lines.push(`Added to the list most (all time): ${added.join(', ')}.`);
  return lines.join('\n');
}

/** Compact totals for one module over the last `days` days (today included), for the assistant. */
export function historySummary(module: HistoryModule, days: number, data: HistoryData, now: Date = new Date()): string {
  const keys = lastNDays(days, now);
  const head = `Last ${days} days, ${keys[0]} to ${keys[keys.length - 1]} (today counts as a part day).`;
  const body = (() => {
    switch (module) {
      case 'money':
        return moneyHistory(data.money, keys);
      case 'food':
        return foodHistory(data.food, keys);
      case 'activity':
        return activityHistory(data.activity, keys);
      case 'chores':
        return choresHistory(data.chores, keys, now);
      case 'shopping':
        return shoppingHistory(data.shopping, data.kitchen, keys);
    }
  })();
  return `${head}\n${body}`;
}
