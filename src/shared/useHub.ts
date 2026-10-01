import { useEffect, useMemo, useState } from 'react';
import { minutesUntilNextWorkout } from '../modules/activity/lib/fitness';
import { useStore as useActivity } from '../modules/activity/lib/store';
import { todayPlan } from '../modules/chores/lib/chores';
import { useStore as useChores } from '../modules/chores/lib/store';
import { daySummary, dailyTargets } from '../modules/food/lib/nutrition';
import { useStore as useFood } from '../modules/food/lib/store';
import { expiryStatus } from '../modules/kitchen/lib/inventory';
import { suggestRecipes } from '../modules/kitchen/lib/recipes';
import { useStore as useKitchen } from '../modules/kitchen/lib/store';
import { monthSummary } from '../modules/money/lib/budget';
import { useStore as useMoney } from '../modules/money/lib/store';
import { morningBriefing } from '../modules/planner/lib/planner';
import { useStore as usePlanner } from '../modules/planner/lib/store';
import { estimateList } from '../modules/shopping/lib/shopping';
import { useStore as useShopping } from '../modules/shopping/lib/store';
import { latest } from '../modules/weather/lib/indoor';
import { outfitAdvice, rainWindow } from '../modules/weather/lib/outfit';
import { useStore as useWeather } from '../modules/weather/lib/store';
import { hoursOf } from '../modules/weather/lib/weather';
import { connections, type Snapshot } from './connections';
import { toDateKey } from './dates';

/** Re-renders every minute so "now"-based tips stay right. */
function useNow(): Date {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/** Today's state of every module, plus the cross-module tips. */
export function useHub() {
  const now = useNow();
  const today = toDateKey(now);
  const food = useFood();
  const activity = useActivity();
  const kitchen = useKitchen();
  const shopping = useShopping();
  const money = useMoney();
  const chores = useChores();
  const planner = usePlanner();
  const weather = useWeather();

  return useMemo(() => {
    const targets = food.state.profile ? dailyTargets(food.state.profile) : null;
    const day = daySummary(today, food.state.foods, food.state.water);
    const waterGoal = targets?.waterMl ?? 2000;

    const steps = activity.state.steps[today] ?? 0;
    const stepGoal = activity.state.profile?.stepGoal ?? 8000;

    const expiring = kitchen.state.items
      .filter((i) => {
        const st = expiryStatus(i, today);
        return st && st.status !== 'ok' && st.daysLeft >= 0 && st.daysLeft <= 1;
      })
      .map((i) => i.name);
    const recipe = suggestRecipes(kitchen.state.items, today, 1).find((r) => r.usesSoon.length) ?? null;

    const shoppingOpen = shopping.state.items.filter((i) => !i.checked);
    const shoppingEstimate = estimateList(shoppingOpen, shopping.state.prices).total;

    const month = monthSummary(money.state.expenses, money.state.settings, now);

    const capacity = chores.state.settings.dailyMinutes[now.getDay()] ?? 30;
    const pinned = chores.state.pinned.date === today ? chores.state.pinned.taskIds : [];
    const choresPlan = todayPlan(chores.state.tasks, pinned, capacity, now);

    const briefing = morningBriefing(planner.briefingInput, today, now);

    const f = weather.state.forecast;
    const weatherDay = f?.current.time.slice(0, 10) || today;
    const outfit = f ? outfitAdvice(f, weatherDay) : null;
    const rain = f ? rainWindow(hoursOf(f, weatherDay, now.getHours(), 22), 50) : null;
    const indoor = latest(weather.state.readings);

    const snapshot: Snapshot = {
      now,
      events: briefing.events,
      busyMinutes: briefing.busyMinutes,
      rainWindow: rain,
      workoutInMinutes: minutesUntilNextWorkout(activity.state.schedule, now),
      waterMl: day.waterMl,
      waterGoal,
      expiringSoon: expiring,
      recipe: recipe ? { name: recipe.recipe.name, emoji: recipe.recipe.emoji, usesSoon: recipe.usesSoon } : null,
      shoppingItems: shoppingOpen.map((i) => i.name),
      shoppingEstimate,
      trip: briefing.trips[0] ? { destination: briefing.trips[0].trip.destination, days: briefing.trips[0].daysUntil } : null,
      choresPlannedMinutes: choresPlan.minutes,
      budgetLeft: month.remaining,
      currency: money.state.settings.currency,
      indoorHumidity: indoor.humidity ?? null,
      humidityLow: weather.state.settings.humidityLow,
    };

    return {
      now,
      tips: connections(snapshot),
      food: { waterMl: day.waterMl, waterGoal, kcal: Math.round(day.nutrients.kcal), kcalGoal: targets?.kcal ?? null },
      activity: { steps, stepGoal, level: activity.state.coach.level },
      kitchen: { expiring, total: kitchen.state.items.length },
      shopping: { count: shoppingOpen.length, estimate: shoppingEstimate, currency: shopping.state.settings.currency },
      money: { spent: month.total, budget: money.state.settings.monthlyBudget, currency: money.state.settings.currency },
      chores: { minutes: choresPlan.minutes, count: choresPlan.tasks.length, laundry: chores.state.laundry },
      planner: briefing,
      weather: { forecast: f, outfit },
    };
  }, [now, today, food.state, activity.state, kitchen.state, shopping.state, money.state, chores.state, planner.briefingInput, weather.state]);
}
