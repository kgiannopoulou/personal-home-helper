# 🏠 Home Helper

**Personal Home Helper, all in one app.** Food, activity, kitchen, shopping, money, chores, planning, weather and quick actions now share one home screen, and they know about each other.

The home screen shows **today across everything**, plus tips that no single part could give on its own:

> 🍌 *Gym at 17:30: have a light carb snack around 16:00 (a banana or toast) for energy.*
> 🥬 *Spinach should be used soon. Tonight: 🍳 Spinach omelette.*
> 🧳 *You leave for London in 3 days: skip Milk, Bread unless you'll finish them before then.*
> 📅 *Busy day (6.5 h booked). Just do the quick chores…*
> 💶 *The shopping list (≈€35.50) is more than what's left this month (€20.00).*
> 💧 *The air at home is dry (28%). Turn on the humidifier.*

## What's inside

Each part was first built as its own app. Here they're modules of one app, with all their features:

| | Module | From |
|---|---|---|
| 🍽️ | **Food & water**: food log, meal photos → calories (AI), water, weekly nutrition gaps, reminders | [food-water-tracker](https://github.com/kgiannopoulou/food-water-tracker) |
| 🏃 | **Activity**: steps, workouts, sleep, weight, adaptive couch-to-5K coach, fuel advice | [activity-coach](https://github.com/kgiannopoulou/activity-coach) |
| 🥫 | **Kitchen**: inventory, receipt scanning (AI), expiry dates, use-it-up recipes, run-out predictions | [kitchen-inventory](https://github.com/kgiannopoulou/kitchen-inventory) |
| 🛒 | **Shopping**: one auto-sorted list, price estimates, weekly budget, spending | [smart-shopping-list](https://github.com/kgiannopoulou/smart-shopping-list) |
| 💶 | **Money**: expenses, budgets, monthly bills, rewards, heating costs | [money-budget](https://github.com/kgiannopoulou/money-budget) |
| 🧹 | **Chores**: rooms and tasks with your own timings, day plans, cleaning mode, laundry, supplies, fair sharing | [home-chores](https://github.com/kgiannopoulou/home-chores) |
| 📅 | **Planner**: morning briefing, phone calendars, to-dos, life admin, birthdays + gift ideas (AI), trips, reviews | [planner-life-admin](https://github.com/kgiannopoulou/planner-life-admin) |
| 🌦️ | **Weather**: what to wear, forecast, indoor humidity, Home Assistant | [weather-environment](https://github.com/kgiannopoulou/weather-environment) |
| ⚡ | **Quick actions**: the watch features (water, "I finished…", run, "I have 10 minutes") | [watch-companion](https://github.com/kgiannopoulou/watch-companion) |

## How the parts are connected

- **One home screen** reads every module's data for today (`src/shared/useHub.ts`), and **cross-module tips** come from pure, tested rules (`src/shared/connections.ts`).
- **No more app-to-app links.** "Send to shopping list" in Kitchen and Chores opens the Shopping module directly. Scanned-receipt totals are logged in **both Shopping and Money**.
- **Quick actions write straight into the modules.** Water goes into Food. "I finished the milk" marks it empty in Kitchen *and* adds it to Shopping. Free minutes come from Chores.
- **Notifications don't clash.** Each module tags its notifications with its own prefix and only replaces its own (`src/shared/notify.ts`).
- **One AI key** (stored in the phone's secure storage) is shared by meal photos, receipts and gift ideas.

## Structure

```
src/
  app/
    index.tsx     # the hub: today across everything + tips
    quick.tsx     # quick actions (the watch features)
    food/ activity/ kitchen/ shopping/ money/ chores/ planner/ weather/   # each module's tabs
  modules/<name>/lib, components   # each module's logic, unchanged from its own app
  shared/
    connections.ts  # cross-module rules
    useHub.ts       # gathers today's state from every module
    Providers.tsx   # all module stores
    notify.ts, ui.tsx, dates.ts, homeCore.ts, HomeButton.tsx
__tests__/<module>/  # every module's tests + the hub's
```

Each module keeps its own storage key, so data is organised exactly as in the separate apps.

## Run it

```bash
npm install
npx expo start        # scan the QR code with Expo Go, or press w for web
npm test              # 137 tests across all modules
npm run typecheck
```

On first start the app asks for the permissions its parts need: notifications, motion (steps), calendar, location (weather) and camera (meal and receipt photos). Everything also works if you say no; you can then enter things by hand.

## Roadmap

- [ ] 🧠 **AI hub**: chat and voice on top of all modules (*"What should I eat before the gym?"*, *"Plan my Saturday"*), using the same snapshot as the tips
- [ ] Shared household sync between phones
- [ ] Watch app syncing with this app
- [ ] Route-aware shopping (*"there's a Lidl on your way home from the gym"*)
