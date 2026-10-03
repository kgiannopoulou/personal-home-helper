import { periodSummary } from '../../activity/lib/fitness';
import { useStore as useActivity } from '../../activity/lib/store';
import { dueText, frequencyLabel } from '../../chores/lib/chores';
import { useStore as useChores } from '../../chores/lib/store';
import { dailyTargets, weekSummary } from '../../food/lib/nutrition';
import { useStore as useFood } from '../../food/lib/store';
import { expiryStatus } from '../../kitchen/lib/inventory';
import { useStore as useKitchen } from '../../kitchen/lib/store';
import { byCategory, EXPENSE_LABEL, inMonth, monthKey } from '../../money/lib/budget';
import { useStore as useMoney } from '../../money/lib/store';
import type { ExpenseCategory } from '../../money/lib/types';
import { addDays, eventsOn, openTodos, sortTodos } from '../../planner/lib/planner';
import { time } from './context';
import { useStore as usePlanner } from '../../planner/lib/store';
import { useStore as useShopping } from '../../shopping/lib/store';
import { useStore as useWeather } from '../../weather/lib/store';
import { weatherLabel } from '../../weather/lib/weather';
import { toDateKey } from '../../../shared/dates';
import { findByName, type Actions } from './catalog';
import { historySummary } from './history';
import { WEEKDAY_NAMES } from './plan';

const at = (date: string, hhmm: string) => {
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = hhmm.split(':').map(Number);
  return new Date(y, m - 1, d, h, min);
};

const MEAL_EMOJI = { breakfast: '🥣', lunch: '🥗', dinner: '🍽️', snack: '🍎' } as const;
const plusMinutes = (hhmm: string, minutes: number) => {
  const [h, m] = hhmm.split(':').map(Number);
  const t = Math.min(h * 60 + m + minutes, 23 * 60 + 59);
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

/** Binds the actions to the real module stores. */
export function useAssistantActions(): Actions {
  const food = useFood();
  const activity = useActivity();
  const kitchen = useKitchen();
  const shopping = useShopping();
  const money = useMoney();
  const chores = useChores();
  const planner = usePlanner();
  const weather = useWeather();

  const actions: Actions = {
    addToShopping(items) {
      const added = shopping.addItems(items.map((name) => ({ name })), 'manual');
      return added ? `Added ${items.join(', ')} to the shopping list.` : `${items.join(', ')} ${items.length > 1 ? 'were' : 'was'} already on the shopping list.`;
    },
    markFinished(items) {
      const kitchenNote = kitchen.runCommand({ action: 'empty', names: items });
      shopping.addItems(items.map((name) => ({ name })), 'inventory');
      return `Marked ${items.join(', ')} as finished in the kitchen and put ${items.length > 1 ? 'them' : 'it'} on the shopping list. ${kitchenNote}`.trim();
    },
    markBought(items) {
      return kitchen.runCommand({ action: 'bought', names: items }) || `Restocked ${items.join(', ')}.`;
    },
    logWater(ml) {
      food.addWater(ml, 'water');
      return `Logged ${ml} ml of water.`;
    },
    logFood(f) {
      food.addFood({ ...f, source: 'ai' });
      return `Logged ${f.name} for ${f.meal} (${Math.round(f.kcal)} kcal, ${Math.round(f.protein)} g protein).`;
    },
    logWorkout(w) {
      activity.addWorkout(w);
      return `Logged ${w.minutes} min of ${w.type} (${w.intensity}).`;
    },
    addTodo(t) {
      planner.addTodo(t);
      return `Added to-do “${t.title}”${t.due ? ` for ${t.due}` : ''}.`;
    },
    addEvent(e) {
      const allDay = !e.start;
      const start = allDay ? at(e.date, '00:00') : at(e.date, e.start!);
      const end = allDay ? new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1) : e.end ? at(e.date, e.end) : new Date(start.getTime() + 3600000);
      planner.addEvent({ title: e.title, allDay, start: start.toISOString(), end: end.toISOString(), location: e.location });
      return `Added “${e.title}” on ${e.date}${allDay ? '' : ` at ${e.start}`} to the planner.`;
    },
    addExpense(e) {
      money.addExpense({ amount: Math.round(e.amount * 100) / 100, category: e.category, note: e.note });
      return `Logged ${money.state.settings.currency}${e.amount.toFixed(2)} under ${EXPENSE_LABEL[e.category]}.`;
    },
    completeChore(name) {
      const task = findByName(chores.state.tasks, name);
      if (!task) return `No chore called “${name}” found.`;
      chores.completeTask(task.id);
      return `Marked “${task.name}” as done.`;
    },
    addChoreToToday(name) {
      const task = findByName(chores.state.tasks, name);
      if (!task) return `No chore called “${name}” found.`;
      chores.pinToday(task.id);
      return `Added “${task.name}” (${task.minutes} min) to today's chores.`;
    },
    startLaundry(type, minutes) {
      const m = minutes ?? chores.state.settings.laundryMinutes;
      chores.startLaundry(type, m);
      return `Started a ${type} laundry load (${m} min). You'll get a notification when it's ready.`;
    },
    lookUp(section) {
      const today = toDateKey();
      switch (section) {
        case 'kitchen':
          return (
            kitchen.state.items
              .map((i) => {
                const st = expiryStatus(i, today);
                return `${i.name}: ${i.level}, ${i.location}${st ? `, expires in ${st.daysLeft} days` : ''}`;
              })
              .join('\n') || 'The kitchen inventory is empty.'
          );
        case 'shopping':
          return shopping.state.items.map((i) => `${i.checked ? '[x]' : '[ ]'} ${i.name}${i.quantity ? ` (${i.quantity})` : ''} - ${i.category}`).join('\n') || 'The shopping list is empty.';
        case 'chores':
          return chores.state.tasks
            .map((t) => `${t.name} (${chores.state.rooms.find((r) => r.id === t.roomId)?.name ?? ''}): ${frequencyLabel(t.everyDays)}, ${t.minutes} min, ${dueText(t)}`)
            .join('\n');
        case 'calendar_week':
          return Array.from({ length: 7 }, (_, i) => addDays(today, i))
            .map((d) => `${d}: ${eventsOn(planner.events, d).map((e) => (e.allDay ? e.title : `${time(e.start)}–${time(e.end)} ${e.title}`)).join('; ') || 'free'}`)
            .join('\n');
        case 'todos':
          return sortTodos(openTodos(planner.state.todos)).map((t) => `${t.title}${t.due ? ` (due ${t.due})` : ''}${t.minutes ? `, ${t.minutes} min` : ''}`).join('\n') || 'No open to-dos.';
        case 'food_week': {
          if (!food.state.profile) return 'No food profile set, so there are no targets. Totals only are in today’s summary.';
          const w = weekSummary(food.state.foods, food.state.water, dailyTargets(food.state.profile));
          return [
            `Logged on ${w.loggedDays} of the last 7 days. Daily average: ${Math.round(w.average.kcal)} kcal, protein ${Math.round(w.average.protein)} g, fibre ${Math.round(w.average.fiber)} g, water ${Math.round(w.average.waterMl)} ml.`,
            `Gaps: ${w.gaps.map((g) => `${g.key} ${g.direction} (${Math.round(g.ratio * 100)}% of target)`).join(', ') || 'none'}.`,
            `Diet: ${food.state.profile.diet}, goal: ${food.state.profile.goal}.`,
          ].join('\n');
        }
        case 'activity_week': {
          const s = periodSummary(activity.state, 7);
          return `Last 7 days: ${s.workouts} workouts, ${s.activeMinutes} active min, avg ${Math.round(s.avgSteps)} steps, sleep ${s.avgSleep ?? '?'} h avg, latest weight ${s.latestWeight ?? '?'} kg${s.weightChange !== null ? ` (${s.weightChange > 0 ? '+' : ''}${s.weightChange} kg)` : ''}, ${s.coachRuns} coached runs.`;
        }
        case 'money': {
          const month = inMonth(money.state.expenses, monthKey());
          const cats = byCategory(month);
          const c = money.state.settings.currency;
          return [
            `This month by category: ${Object.entries(cats)
              .filter(([, v]) => v > 0)
              .map(([k, v]) => `${EXPENSE_LABEL[k as ExpenseCategory]} ${c}${v.toFixed(2)}`)
              .join(', ') || 'nothing yet'}`,
            `Recent: ${[...month].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10).map((e) => `${e.date} ${c}${e.amount.toFixed(2)} ${e.note ?? e.category}`).join('; ') || 'none'}`,
          ].join('\n');
        }
        case 'forecast': {
          const f = weather.state.forecast;
          if (!f) return 'The forecast has not loaded.';
          return f.days.map((d) => `${d.date}: ${weatherLabel(d.code).text}, ${Math.round(d.min)}–${Math.round(d.max)}°C, rain ${d.rainChance}%`).join('\n');
        }
      }
    },
    planMeal(m) {
      const at = m.meal === 'snack' ? '16:00' : food.state.reminders.meals[m.meal];
      const title = `${MEAL_EMOJI[m.meal]} ${m.meal[0].toUpperCase()}${m.meal.slice(1)}: ${m.name}`;
      return actions.addEvent({ title, date: m.date, start: at, end: plusMinutes(at, m.meal === 'snack' ? 15 : 45) });
    },
    setTrainingDays(weekdays, time) {
      const days = [...new Set(weekdays)].sort();
      activity.setSchedule({ ...activity.state.schedule, enabled: true, weekdays: days, time: time ?? activity.state.schedule.time });
      return `Workouts now on ${days.map((d) => WEEKDAY_NAMES[d - 1]).join(', ')} at ${time ?? activity.state.schedule.time}.`;
    },
    updateKitchenStock(items) {
      return `Kitchen updated: ${kitchen.applyStock(items)}.`;
    },
    addBill(b) {
      const c = money.state.settings.currency;
      planner.addAdmin({ title: b.title, kind: b.kind, due: b.due, amount: b.amount, repeatMonths: b.repeatMonths ?? 0, remindDays: 3 });
      return `Added “${b.title}”${b.amount ? ` (${c}${b.amount.toFixed(2)})` : ''} to life admin, due ${b.due}. You'll be reminded 3 days before.`;
    },
    lookUpHistory(module, days) {
      return historySummary(module, days, {
        money: money.state,
        food: food.state,
        activity: activity.state,
        chores: chores.state,
        shopping: shopping.state,
        kitchen: kitchen.state,
      });
    },
  };
  return actions;
}
