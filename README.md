# 🏠 Home Helper

**Personal Home Helper, all in one app.** Food, activity, kitchen, shopping, money, chores, planning, weather and quick actions now share one home screen, and they know about each other. On top sits **🧠 the AI Hub**: an assistant that sees your whole day and can act in every part of the app.

The home screen shows **today across everything**, plus tips that no single part could give on its own:

> 🍌 *Gym at 17:30: have a light carb snack around 16:00 (a banana or toast) for energy.*
> 🥬 *Spinach should be used soon. Tonight: 🍳 Spinach omelette.*
> 🧳 *You leave for London in 3 days: skip Milk, Bread unless you'll finish them before then.*
> 📅 *Busy day (6.5 h booked). Just do the quick chores…*
> 💶 *The shopping list (≈€35.50) is more than what's left this month (€20.00).*
> 💧 *The air at home is dry (28%). Turn on the humidifier.*

## 🧠 AI Hub: ask Home Helper

Chat with an assistant (Claude) that sees today across every module and can update them for you:

| You say | It does |
|---|---|
| *"Plan my day"* | A short timeline around your calendar, meals, gym, chores and errands, using your free gaps |
| *"What should I eat before the gym?"* | Looks at your calendar, what you've eaten, your diet and what's in the kitchen |
| *"What can I cook tonight?"* | Prefers food that expires soon, matches your diet and protein gap |
| *"I finished the milk and the eggs"* | Marks them empty in Kitchen and adds them to Shopping ✓ |
| *"I had a chicken salad for lunch"* | Logs it with estimated calories and macros ✓ |
| *"I spent €12 on lunch"*, *"Remind me to call the dentist Friday"*, *"Vacuum done"*, *"Start a darks wash"* | Logs the expense, adds the to-do, ticks off the chore, starts the laundry timer ✓ |
| *"How is my budget looking?"*, *"What should I wear?"* | Reads Money and the forecast |
| *"Plan my week"*, *"Make a meal plan for this week"* | Proposes a plan as a card: events in your free time, meals that use food expiring soon, missing ingredients for the shopping list, new workout days. **Nothing changes until you tap Apply** (and you can untick parts first) |
| *"Why am I over budget?"*, *"Am I sleeping worse?"*, *"What chores do I keep skipping?"* | Looks back over weeks of history and names the pattern: *"you spend about 40% more in weeks without a big shop"*, *"your runs go better after 7 hours of sleep"* |
| 📷 *a photo of your fridge* | Updates the kitchen: how full things look, and items it hadn't tracked yet ✓ |
| 📷 *a photo of a bill* | Adds it to life admin with the amount and due date, so you're reminded before it's due ✓ |
| 📷 *a photo of your meal* | Logs it with estimated calories and macros ✓ |
| *"I'm vegetarian"*, *"I don't like mushrooms"*, *"I go to the gym on Tuesdays"* | Remembers it for every future chat ✓ |

- **19 tools**: `look_up` (detailed data on request), `look_up_history` (trends over past weeks or months) plus actions for shopping, kitchen, water, food, workouts, to-dos, events, expenses, chores and laundry, `update_kitchen_stock` and `add_bill` for photos, `propose_plan` for bigger plans you confirm, and `remember` / `forget` for its memory. Small actions happen straight away; plans need a tap. Everything it changed is shown under its reply (*"✓ Added Milk to the shopping list"*).
- **Photos**: tap 📷 (camera) or 🖼️ (gallery) next to the message box. Photos are scaled to 1568 px and compressed before sending. Each one is saved apart from the chat and put back exactly as sent, so the conversation history never changes (which keeps prompt caching working).
- **Voice**: dictate with your keyboard's 🎤, and switch on *"Read replies aloud"* (text-to-speech).
- **Built with** Claude Opus 5.5 through the Anthropic SDK's tool runner, with inputs checked by Zod. Each question carries a compact snapshot of today (`context.ts`). The system prompt and tool list stay fixed and the chat is append-only, so prompt caching keeps follow-up questions cheap. Refusals fall back automatically to another model.
- A new chat starts each day. You can start one any time with **New chat**.
- **Proactive**: the first time you open the app each day, one low-effort call reads today, the last 4 weeks and what it remembers, and writes **3 nudges** for the home screen (cached for the day; ↻ to redo them). From 17:00 it writes tomorrow's instead, and they're added to the **morning notification**. On **Sunday** (or Monday if you missed it) a **weekly review** covers budget pace, nutrition gaps and chores that slipped, with a **plan for next week** to apply; a notification reminds you at 18:00. Both use structured output (a JSON schema), so the app gets exactly the shape it shows.
- **History**: today's snapshot only covers today, so for trends and "why" questions the assistant calls `look_up_history(module, days)`. It gets compact totals, not raw logs: spending per week and category, the change versus the period before, and weeks with vs without a big grocery shop (money); average water and food, weekdays vs weekends (food); steps, sleep and workouts per week, and how days and coached runs go after good vs short nights (activity); chores that keep slipping (chores); shopping trips, usual days and how often each item gets bought (shopping). Windows over 16 weeks are grouped by month.
- **Memory**: lasting facts about you (tastes, diet and allergies, routines, goals, people close to you) are saved when you mention them and sent with every question, so the assistant keeps knowing you across days. Tap **Memory** under the chat to see everything it remembers and delete any fact. Memory stays on your phone.

## 🔄 Sync with your household

Sign in to your [Home Helper server](https://github.com/kgiannopoulou/home-helper-api) (⚙️ on the home screen → **Account & sync**), and the people you live with share one shopping list, kitchen, money, chores and planner. Add milk on one phone, and it's on the other after the next sync. Food, water, sleep, steps, workouts and weight stay yours: they only sync to your own other phones. The same account also opens the [web dashboard](https://github.com/kgiannopoulou/home-helper-api#web-dashboard), with charts of spending, health and chores and a week planner.

- **Offline first.** The phone's own storage is still the copy you use; sync swaps changes in the background. It runs when the app opens, when you come back to it, and 4 seconds after a change, and tries again a minute later when there's no connection.
- **Household** (Settings → Household): see the members, invite someone by email (owner), paste an invite link to join, switch household, or start a new one. Once you're signed in, the household's people are the chore members, so fair share and "who did it" are real people.
- **Last write wins.** Each record carries the time it was last changed; the server keeps the newer one, and an older change never overwrites a newer one. Deleting something sends a tombstone, so it's deleted on the other phones too.
- **The server does the scheduled work, with the app closed.** It fills the shopping list the evening before shopping day, adds bills on their day, learns chore frequencies, warns when the month is heading over budget, and sends a Sunday summary, as push notifications (and an email for the summary). Tapping one opens that screen. While you're in a household, the phone stops filling the list and changing chore frequencies itself, so two phones never add the same milk twice.
- **Push needs a development build** (`npx expo run:android`), not Expo Go, and an EAS project id (`npx eas init` adds `extra.eas.projectId` to app.json). Settings → Account & sync shows whether the server can reach this phone and, if not, why. Signing out stops the pushes.

How it works (`src/shared/sync`):

| File | What it does |
|---|---|
| `engine.ts` | The rules, as pure functions: **observe** (notice changed, new and deleted records), **pending** (what to send), **acknowledge**, **mergeModule** (last write wins, renames, tombstones), and `syncOnce`, one round trip |
| `collections.ts` | The 18 mappings between each module's records and the server's rows. Phone-only fields (a kitchen item's price, whether you've seen a learned chore change) never trigger a sync and survive one. Steps, kept per day without ids, get an id made from you and the day (`stepsId()`, the same as the server's), and only finished days sync |
| `SyncProvider.tsx` | Connects the engine to the module stores (each store has an `applySync`), storage, the app state and the timers |
| `account.ts`, `api.ts` | The token (secure storage), account and sync state, and the server calls |
| `push.ts`, `pushRoute.ts` | This phone's Expo push token (registered with the server after sign-in), and which screen a tapped push opens |

**The ledger instead of changing every record.** The modules keep their records exactly as before. A ledger beside them keeps, per record, a hash of what the server sees, `updatedAt`, a `dirty` flag and tombstones. Every change in a store is compared with it as it happens. A changed hash gets a new `updatedAt`; a record that's gone becomes a tombstone. That way, none of the screens and rules reading the stores had to learn about deleted records. Chore completions, which the module trims to the last 1,000, are told apart from real deletions: a completion missing because it's older than all the rest was trimmed, so it's not deleted on the server.

New records get **ULID** ids (`newId()`), made on the phone and stored by the server as they are.

`npm test` covers the mappings (every record survives the trip to the server and back) and the merge rules, including two phones against a small in-memory server. `npx tsx scripts/sync-smoke.ts http://localhost:8000` runs two phones with the same engine against a real server with the demo data.

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
- **Predictions from your own data** (`src/shared/predictions.ts`, applied by `PredictionsRunner.tsx`):
  - 🗓️ **Shopping day**: learned from your trips and grocery spends over the last 12 weeks. The day before, your list fills up with what's low or empty, plus whatever will run out before the following shop (from how fast you've used it up before). A reminder comes at 18:00 the evening before.
  - 🔮 **Budget forecast**: *"At this pace: €1,180 of €1,000"* on the home screen and in Money. Early in the month it leans on how your past months went from the same day, and trusts the current pace more as the month goes on.
  - 📈 **Chore frequencies that learn**: when the last 3 times all ran 30% late (you keep skipping it) or 30% early, the chore moves one step (weekly → every 2 weeks, or back). Chores shows what changed, with **Keep** and **Undo**; undoing locks the frequency you set.
- **No more app-to-app links.** "Send to shopping list" in Kitchen and Chores opens the Shopping module directly. Scanned-receipt totals are logged in **both Shopping and Money**.
- **Quick actions write straight into the modules.** Water goes into Food. "I finished the milk" marks it empty in Kitchen *and* adds it to Shopping. Free minutes come from Chores.
- **Notifications don't clash.** Each module tags its notifications with its own prefix and only replaces its own (`src/shared/notify.ts`).
- **One AI key** (stored in the phone's secure storage) is shared by the assistant, meal photos, receipts and gift ideas.

## Structure

```
src/
  app/
    index.tsx     # the hub: today across everything + tips
    assistant.tsx # 🧠 AI Hub chat
    quick.tsx     # quick actions (the watch features)
    food/ activity/ kitchen/ shopping/ money/ chores/ planner/ weather/   # each module's tabs
  modules/<name>/lib, components   # each module's logic, unchanged from its own app
  modules/assistant/lib/
    assistant.ts  # Claude call (tool runner, caching, errors) + system prompt
    context.ts    # today's snapshot as text
    tools.ts      # the 19 tools (Zod schemas)
    actions.ts    # what each tool does in the real modules
    history.ts    # past weeks/months as compact totals (look_up_history)
    plan.ts       # proposed plans: the changes, card text, apply
    photos.ts     # photos in the chat: sizing, saving apart from the history
    pickPhoto.ts  # camera/gallery + resize (expo-image-manipulator)
    proactive.ts  # daily nudges + weekly review (structured output)
    useProactive.tsx  # runs them once a day / on Sunday, feeds the morning notification
  modules/assistant/components/PlanCard.tsx  # plan card with Apply
    memory.ts     # remembered facts: add, forget, as text
    chat.ts       # saved chat, saved memory + suggestions
  app/settings/     # Account & sync, Household
  shared/
    connections.ts  # cross-module rules
    predictions.ts  # shopping day, budget forecast, chore frequencies
    PredictionsRunner.tsx  # applies them (list before shopping day, learned chores)
    useHub.ts       # gathers today's state from every module
    Providers.tsx   # all module stores, then sync
    sync/           # household sync: engine, mappings, SyncProvider, account + API
    notify.ts, ui.tsx, dates.ts, homeCore.ts, HomeButton.tsx
__tests__/<module>/  # every module's tests + the hub's
```

Each module keeps its own storage key, so data is organised exactly as in the separate apps.

## Run it

```bash
npm install
npx expo start        # scan the QR code with Expo Go, or press w for web
npm test              # 239 tests across all modules, the assistant and sync
npm run typecheck
```

On first start the app asks for the permissions its parts need: notifications, motion (steps), calendar, location (weather) and camera (meal and receipt photos). Everything also works if you say no; you can then enter things by hand.

## Roadmap

- [x] 🧠 **AI Hub**: chat and voice across all modules
- [x] 🗂️ **Assistant memory** across chats
- [x] 📈 **History and trends** for "why" questions
- [x] ✨ **Proactive**: daily nudges and a Sunday weekly review
- [x] 🗓️ **Plans you apply**: week plans and meal plans behind an Apply button
- [x] 📷 **Photos in the chat**: fridge, bills and meals
- [x] 🔮 **Predictions**: shopping day, budget forecast, chore frequencies that learn
- [ ] Hands-free voice (speech recognition in a development build)
- [x] 🔄 **Shared household sync** between phones ([home-helper-api](https://github.com/kgiannopoulou/home-helper-api))
- [x] 🔔 **Push from the server**: shopping list, bills, budget alerts and a weekly summary with the app closed
- [ ] Watch app syncing with this app
- [ ] Route-aware shopping (*"there's a Lidl on your way home from the gym"*)
