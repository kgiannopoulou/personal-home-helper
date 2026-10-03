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
npm test              # 186 tests across all modules and the assistant
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
- [ ] Hands-free voice (speech recognition in a development build)
- [ ] Shared household sync between phones
- [ ] Watch app syncing with this app
- [ ] Route-aware shopping (*"there's a Lidl on your way home from the gym"*)
