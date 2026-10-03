/**
 * Two phones against a real home-helper-api, using the app's own sync engine.
 *
 *   npx tsx scripts/sync-smoke.ts http://localhost:8000
 *
 * Phone A (demo@homehelper.test) adds something to the shopping list; phone B
 * (alex@homehelper.test, same household) sees it after its next sync, ticks it off, and A sees that.
 */
import { syncOnce, type SyncIO } from '../src/shared/sync/engine';
import type { Ledger, ModuleName, ModuleStates, SyncRequest, SyncResponse } from '../src/shared/sync/types';

const base = (process.argv[2] ?? 'http://localhost:8000').replace(/\/$/, '');

async function api<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const res = await fetch(`${base}/api${path}`, {
    ...init,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}) },
  });
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path}: ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

function emptyStates(): ModuleStates {
  return {
    money: { expenses: [], recurring: [], rewards: [], appliances: [], settings: {} },
    kitchen: { items: [], toBuy: [], settings: {} },
    shopping: { items: [], trips: [], prices: {}, history: {}, settings: {} },
    chores: { rooms: [], tasks: [], completions: [], supplies: [], members: [], laundry: null, pinned: { date: '', taskIds: [] }, settings: {} },
    food: { profile: null, foods: [], water: [], reminders: {} },
    activity: { profile: null, workouts: [], sleep: [], weights: [], steps: {}, coach: { level: 1, sessions: [] }, schedule: {} },
    planner: { manualEvents: [], todos: [], admin: [], people: [], tripChecks: {}, settings: {} },
  } as unknown as ModuleStates;
}

async function phone(email: string) {
  const { token, user } = await api<{ token: string; user: { id: number } }>('/login', { method: 'POST', body: JSON.stringify({ email, password: 'password', device_name: 'smoke test' }) });
  const { data: households } = await api<{ data: { id: string }[] }>('/households', { token });
  let ledger: Ledger = {};
  const p = {
    data: emptyStates(),
    since: null as string | null,
    states: () => p.data,
    apply: <M extends ModuleName>(m: M, fn: (s: ModuleStates[M]) => ModuleStates[M]) => {
      p.data = { ...p.data, [m]: fn(p.data[m]) };
    },
    ledger: { get: () => ledger, set: (l: Ledger) => (ledger = l) },
    send: (req: SyncRequest) => api<SyncResponse>(`/households/${households[0].id}/sync`, { method: 'POST', token, body: JSON.stringify(req) }),
    ctx: { userId: user.id },
    async sync(label: string) {
      const r = await syncOnce(p as SyncIO, p.since);
      p.since = r.since;
      console.log(`${label}: sent ${r.sent}, received ${r.received}${r.rejected.length ? `, rejected ${JSON.stringify(r.rejected)}` : ''}`);
    },
  };
  return p;
}

function check(ok: boolean, what: string) {
  console.log(`${ok ? '✓' : '✗'} ${what}`);
  if (!ok) process.exitCode = 1;
}

(async () => {
  const a = await phone('demo@homehelper.test');
  const b = await phone('alex@homehelper.test');
  await a.sync('A first sync');
  await b.sync('B first sync');

  const name = `Oat milk ${new Date().toISOString().slice(11, 19)}`;
  const id = `smoke${Date.now().toString(36)}`;
  a.data = { ...a.data, shopping: { ...a.data.shopping, items: [...a.data.shopping.items, { id, name, category: 'drinks', checked: false, addedAt: new Date().toISOString(), source: 'manual' }] } };
  await a.sync(`A adds "${name}"`);

  await b.sync('B syncs');
  const onB = b.data.shopping.items.find((i) => i.id === id);
  check(onB?.name === name, `B has "${name}"`);

  b.data = { ...b.data, shopping: { ...b.data.shopping, items: b.data.shopping.items.map((i) => (i.id === id ? { ...i, checked: true } : i)) } };
  await b.sync('B ticks it off');
  await a.sync('A syncs');
  check(a.data.shopping.items.find((i) => i.id === id)?.checked === true, 'A sees it ticked off');

  a.data = { ...a.data, shopping: { ...a.data.shopping, items: a.data.shopping.items.filter((i) => i.id !== id) } };
  await a.sync('A deletes it');
  await b.sync('B syncs');
  check(!b.data.shopping.items.some((i) => i.id === id), 'B no longer has it');

  await a.sync('A syncs again');
  await b.sync('B syncs again');
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
