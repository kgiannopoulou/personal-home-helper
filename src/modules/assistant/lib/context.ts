import type { HubData } from '../../../shared/useHub';

// Fixed English, 24-hour formats: the phone's locale (e.g. "03:00 μ.μ.") would make the data ambiguous.
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const pad = (n: number) => String(n).padStart(2, '0');
export const time = (d: Date | string) => {
  const x = typeof d === 'string' ? new Date(d) : d;
  return `${pad(x.getHours())}:${pad(x.getMinutes())}`;
};
export const longDate = (d: Date) => `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

const r = Math.round;
const list = (items: string[], empty = 'none') => (items.length ? items.join('; ') : empty);

/**
 * A compact, plain-text picture of today across every module, sent with each question.
 * Details the assistant needs beyond this come from the look_up tool.
 */
export function todayContext(h: HubData): string {
  const { now, planner, food, activity, kitchen, shopping, money, chores, weather, tips } = h;
  const lines: string[] = [];
  const c = money.currency;

  lines.push(`Now: ${longDate(now)}, ${time(now)}`);

  const timed = planner.events.filter((e) => !e.allDay);
  const allDay = planner.events.filter((e) => e.allDay).map((e) => e.title);
  lines.push(
    `Calendar today: ${list(timed.map((e) => `${time(e.start)}–${time(e.end)} ${e.title}${e.location ? ` @ ${e.location}` : ''}`), 'nothing booked')}` +
      (allDay.length ? ` | all day: ${allDay.join(', ')}` : '') +
      ` | busy ${r((planner.busyMinutes / 60) * 10) / 10} h`,
  );
  lines.push(`Free time left today: ${list(planner.gaps.map((g) => `${time(g.start)}–${time(g.end)}`))}`);
  lines.push(`To-dos due: ${list(planner.todos.map((t) => `${t.title}${t.minutes ? ` (${t.minutes} min)` : ''}${t.due && t.due < planner.date ? ' [overdue]' : ''}`))}`);
  lines.push(`Life admin due soon: ${list(planner.admin.map((a) => `${a.title} (due ${a.due}${a.amount ? `, ${c}${a.amount}` : ''})`))}`);
  if (planner.birthdays.length)
    lines.push(
      `Birthdays: ${planner.birthdays.map((b) => `${b.person.name} in ${b.daysUntil} days${b.person.interests ? ` (likes ${b.person.interests})` : ''}`).join('; ')}`,
    );
  if (planner.trips.length)
    lines.push(`Trips: ${planner.trips.map((t) => `${t.trip.destination} in ${t.daysUntil} days, ${t.trip.nights} nights`).join('; ')}`);

  if (weather.forecast) {
    const f = weather.forecast;
    lines.push(
      `Weather (${f.placeName}): now ${r(f.current.temp)}°C, feels ${r(f.current.feels)}°C` +
        (weather.outfit ? ` | today ${weather.outfit.summary} | outfit: ${weather.outfit.headline}: ${weather.outfit.items.map((i) => i.text).join(' ')}` : '') +
        (weather.rain ? ` | rain later ${weather.rain}` : ''),
    );
  } else lines.push('Weather: not loaded');
  if (weather.indoor.humidity !== undefined || weather.indoor.temperature !== undefined) {
    lines.push(
      `Indoors: ${weather.indoor.humidity !== undefined ? `humidity ${r(weather.indoor.humidity)}%` : ''}${weather.indoor.temperature !== undefined ? ` ${weather.indoor.temperature.toFixed(1)}°C` : ''}`.trim(),
    );
  }

  const n = food.nutrients;
  const t = food.targets;
  lines.push(
    `Food today: water ${food.waterMl}/${food.waterGoal} ml | ${r(n.kcal)}${t ? `/${t.kcal}` : ''} kcal, protein ${r(n.protein)}${t ? `/${t.protein}` : ''} g, carbs ${r(n.carbs)}${t ? `/${t.carbs}` : ''} g, fat ${r(n.fat)}${t ? `/${t.fat}` : ''} g, fibre ${r(n.fiber)}${t ? `/${t.fiber}` : ''} g${t ? '' : ' (no profile set, so no targets)'}`,
  );
  lines.push(
    `Activity: ${activity.steps}/${activity.stepGoal} steps | run coach level ${activity.level}` +
      (activity.workoutInMinutes !== null ? ` | next scheduled workout in ${activity.workoutInMinutes} min` : ''),
  );

  lines.push(
    `Kitchen (${kitchen.total} items): use soon: ${list(kitchen.expiring)} | low or empty: ${list(kitchen.low)}` +
      (kitchen.recipe ? ` | recipe idea: ${kitchen.recipe.name}` : ''),
  );
  lines.push(
    `Shopping list: ${shopping.count ? `${shopping.count} items, about ${shopping.currency}${shopping.estimate.toFixed(2)}` : 'empty'}` +
      (shopping.day ? ` | usual shopping day ${shopping.day.name}, next ${shopping.day.next}` : ''),
  );
  lines.push(
    `Money: ${c}${money.spent.toFixed(2)} spent this month${money.budget ? ` of ${c}${money.budget} budget (${c}${(money.budget - money.spent).toFixed(2)} left)` : ', no budget set'}` +
      (money.forecast ? ` | forecast: ${money.forecast.text}` : ''),
  );

  lines.push(
    `Chores planned today (${chores.minutes} of ${chores.capacity} free min): ${list(chores.tasks.map((x) => `${x.name} (${x.minutes} min)`))}` +
      (chores.laundry ? ` | laundry running since ${time(chores.laundry.startedAt)} (${chores.laundry.minutes} min cycle)` : ''),
  );

  if (tips.length) lines.push(`App tips right now: ${tips.map((x) => x.text).join(' ')}`);
  return lines.join('\n');
}
