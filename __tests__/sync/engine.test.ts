import { describe, expect, test } from '@jest/globals';
import type { Completion, Room, Task } from '../../src/modules/chores/lib/types';
import type { InventoryItem } from '../../src/modules/kitchen/lib/types';
import type { ListItem } from '../../src/modules/shopping/lib/types';
import { acknowledge, mergeModule, observe, pending, syncOnce, withHouseholdMembers, type SyncIO } from '../../src/shared/sync/engine';
import type { Ledger, ModuleName, ModuleStates, Row, SyncRequest, SyncResponse } from '../../src/shared/sync/types';

const ctx = { userId: 7 };
const T1 = '2026-10-03T09:00:00.000Z';
const T2 = '2026-10-03T10:00:00.000Z';
const T3 = '2026-10-03T11:00:00.000Z';

/** Just enough of each module for the sync layer. */
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

const milk = (patch: Partial<ListItem> = {}): ListItem => ({ id: 'milk', name: 'Milk', category: 'drinks', checked: false, addedAt: T1, source: 'manual', ...patch });
const reply = (patch: Partial<SyncResponse> = {}): SyncResponse => ({ since: T3, changes: {}, remapped: {}, rejected: [], ...patch });

describe('noticing changes', () => {
  test('a new record is dirty from now; looking again changes nothing', () => {
    const shopping = { ...emptyStates().shopping, items: [milk()] };
    const l1 = observe({}, 'shopping', shopping, ctx, T1);
    expect(l1.shopping_items.milk).toMatchObject({ updatedAt: T1, dirty: true });
    expect(observe(l1, 'shopping', shopping, ctx, T2)).toBe(l1);
  });

  test('an edit gets a new time; a removal becomes a tombstone', () => {
    const before = { ...emptyStates().shopping, items: [milk()] };
    const synced = acknowledge(observe({}, 'shopping', before, ctx, T1), { shopping_items: { milk: observe({}, 'shopping', before, ctx, T1).shopping_items.milk } }, reply());
    expect(synced.shopping_items.milk.dirty).toBeUndefined();

    const edited = observe(synced, 'shopping', { ...before, items: [milk({ checked: true })] }, ctx, T2);
    expect(edited.shopping_items.milk).toMatchObject({ updatedAt: T2, dirty: true });

    const removed = observe(synced, 'shopping', { ...before, items: [] }, ctx, T3);
    expect(removed.shopping_items.milk).toMatchObject({ updatedAt: T3, deleted: true, dirty: true });
    expect(pending(removed, emptyStates(), ctx).changes.shopping_items).toEqual([{ id: 'milk', updated_at: T3, deleted_at: T3 }]);
  });

  test('phone-only fields are not a change', () => {
    const item: InventoryItem = { id: 'i', name: 'Rice', category: 'food', location: 'pantry', level: 'full', boughtAt: '2026-09-01', purchases: ['2026-09-01'] };
    const l = observe({}, 'kitchen', { ...emptyStates().kitchen, items: [item] }, ctx, T1);
    expect(observe(l, 'kitchen', { ...emptyStates().kitchen, items: [{ ...item, price: 2.4 }] }, ctx, T2)).toBe(l);
  });

  test('chore completions trimmed by the module are not deletions, an undo is', () => {
    const done = (id: string, at: string): Completion => ({ id, taskId: 't', at, minutes: 10 });
    const chores = { ...emptyStates().chores, completions: [done('a', '2026-09-01T10:00:00.000Z'), done('b', '2026-09-02T10:00:00.000Z'), done('c', '2026-09-03T10:00:00.000Z')] };
    const l = observe({}, 'chores', chores, ctx, T1);

    // The oldest fell off the end, and the newest was undone
    const after = observe(l, 'chores', { ...chores, completions: [chores.completions[1]] }, ctx, T2);
    expect(after.chore_completions.a).toBeUndefined();
    expect(after.chore_completions.c).toMatchObject({ deleted: true, dirty: true });
  });
});

describe('sending', () => {
  test('rows have the server\'s shape, the id and the change time', () => {
    const l = observe({}, 'shopping', { ...emptyStates().shopping, items: [milk({ quantity: '2' })] }, ctx, T1);
    const states = { ...emptyStates(), shopping: { ...emptyStates().shopping, items: [milk({ quantity: '2' })] } };
    expect(pending(l, states, ctx).changes).toEqual({
      shopping_items: [{ id: 'milk', name: 'Milk', category: 'drinks', quantity: '2', price: null, checked: false, source: 'manual', updated_at: T1 }],
    });
  });

  test('acknowledged changes are clean, refused ones aren\'t sent again, and changes made meanwhile stay dirty', () => {
    const states = { ...emptyStates(), shopping: { ...emptyStates().shopping, items: [milk(), milk({ id: 'bread', name: 'Bread' })] } };
    const l = observe({}, 'shopping', states.shopping, ctx, T1);
    const { sent } = pending(l, states, ctx);
    const meanwhile = observe(l, 'shopping', { ...states.shopping, items: [milk({ checked: true }), milk({ id: 'bread', name: 'Bread' })] }, ctx, T2);

    const after = acknowledge(meanwhile, sent, reply({ rejected: [{ collection: 'shopping_items', id: 'bread', reason: 'invalid' }] }));
    expect(after.shopping_items.milk).toMatchObject({ dirty: true, updatedAt: T2 });
    expect(after.shopping_items.bread).toMatchObject({ dirty: false, rejected: 'invalid' });
    expect(pending(after, states, ctx).changes.shopping_items?.map((r) => r.id)).toEqual(['milk']);
  });
});

describe('merging the reply', () => {
  const row = (patch: Partial<Row> = {}): Row => ({ id: 'milk', name: 'Milk', category: 'drinks', quantity: '2', price: null, checked: true, source: 'manual', updated_at: T2, deleted_at: null, ...patch });

  test('a newer row from the server replaces ours and isn\'t sent back', () => {
    const shopping = { ...emptyStates().shopping, items: [milk()] };
    const l = acknowledge(observe({}, 'shopping', shopping, ctx, T1), {}, reply());
    const clean: Ledger = { shopping_items: { milk: { ...l.shopping_items.milk, dirty: undefined } } };

    const r = mergeModule(shopping, 'shopping', reply({ changes: { shopping_items: [row()] } }), clean, ctx);
    expect(r.state.items).toEqual([{ ...milk(), quantity: '2', checked: true }]);
    expect(observe(r.ledger, 'shopping', r.state, ctx, T3)).toBe(r.ledger);
  });

  test('our newer change waiting to go up is kept', () => {
    const shopping = { ...emptyStates().shopping, items: [milk({ checked: false })] };
    const l = observe({}, 'shopping', shopping, ctx, T3);
    const r = mergeModule(shopping, 'shopping', reply({ changes: { shopping_items: [row({ updated_at: T2 })] } }), l, ctx);
    expect(r.state.items[0].checked).toBe(false);
  });

  test('a change made here but not looked at yet is kept', () => {
    const shopping = { ...emptyStates().shopping, items: [milk()] };
    const l = observe({}, 'shopping', shopping, ctx, T1);
    const clean: Ledger = { shopping_items: { milk: { ...l.shopping_items.milk, dirty: undefined } } };
    const editedJustNow = { ...shopping, items: [milk({ name: 'Oat milk' })] };

    expect(mergeModule(editedJustNow, 'shopping', reply({ changes: { shopping_items: [row()] } }), clean, ctx).state.items[0].name).toBe('Oat milk');
  });

  test('a deletion from the server removes the record', () => {
    const shopping = { ...emptyStates().shopping, items: [milk()] };
    const l: Ledger = { shopping_items: { milk: { ...observe({}, 'shopping', shopping, ctx, T1).shopping_items.milk, dirty: undefined } } };
    const r = mergeModule(shopping, 'shopping', reply({ changes: { shopping_items: [row({ deleted_at: T2 })] } }), l, ctx);
    expect(r.state.items).toEqual([]);
    expect(r.ledger.shopping_items.milk).toBeUndefined();
  });

  test('a room joined to the household\'s "Kitchen" takes its id, and its chores follow', () => {
    const room: Room = { id: 'mine', name: 'Kitchen', emoji: '🍳' };
    const task: Task = { id: 't1', name: 'Mop', roomId: 'mine', everyDays: 7, minutes: 15 };
    const chores = { ...emptyStates().chores, rooms: [room], tasks: [task] };
    let l = observe({}, 'chores', chores, ctx, T1);
    l = acknowledge(l, pending(l, { ...emptyStates(), chores }, ctx).sent, reply());

    const r = mergeModule(chores, 'chores', reply({ remapped: { rooms: { mine: 'theirs' } } }), l, ctx);
    expect(r.state.rooms.map((x) => x.id)).toEqual(['theirs']);
    expect(r.state.tasks[0].roomId).toBe('theirs');
    // Nothing to send: the server renamed them too
    expect(observe(r.ledger, 'chores', r.state, ctx, T2)).toBe(r.ledger);
  });

  test('a chore done on the other phone updates "last done"', () => {
    const task: Task = { id: 't1', name: 'Mop', roomId: 'r', everyDays: 7, minutes: 15, lastDone: '2026-09-20T10:00:00.000Z' };
    const chores = { ...emptyStates().chores, tasks: [task] };
    const r = mergeModule(chores, 'chores', reply({ changes: { chore_completions: [{ id: 'c1', chore_id: 't1', done_at: '2026-10-02T18:00:00+00:00', minutes: 20, user_id: 8, updated_at: T2 }] } }), {}, ctx);

    expect(r.state.tasks[0].lastDone).toBe('2026-10-02T18:00:00.000Z');
    expect(r.state.completions[0]).toEqual({ id: 'c1', taskId: 't1', at: '2026-10-02T18:00:00.000Z', by: '8', minutes: 20 });
  });

  test('signed in, the household\'s people are the chore members', () => {
    expect(withHouseholdMembers(emptyStates().chores, [{ id: 7, name: 'Konstantina' }, { id: 8, name: 'Alex' }], 7)).toMatchObject({
      members: [{ id: '7', name: 'Konstantina' }, { id: '8', name: 'Alex' }],
      meId: '7',
    });
  });
});

/**
 * A small server with the same rules as home-helper-api's SyncService: last write wins on
 * updated_at, a tie keeps what's stored, and each reply has what changed since the phone's last sync.
 */
function fakeServer() {
  let clock = 0;
  const rows = new Map<string, Row & { _v: number; _collection: string }>();
  return async (req: SyncRequest): Promise<SyncResponse> => {
    const since = req.since === null ? -1 : Number(req.since);
    const accepted = new Set<string>();
    for (const [collection, incoming] of Object.entries(req.changes)) {
      for (const row of incoming) {
        const stored = rows.get(row.id);
        if (stored && Date.parse(stored.updated_at) >= Date.parse(row.updated_at)) continue;
        rows.set(row.id, { ...(row.deleted_at ? stored : {}), ...row, _v: ++clock, _collection: collection });
        accepted.add(row.id);
      }
    }
    const changes: Record<string, Row[]> = {};
    for (const { _v, _collection, ...row } of rows.values()) {
      if (_v > since && !accepted.has(row.id)) (changes[_collection] ??= []).push(row as Row);
    }
    return { since: String(clock), changes, remapped: {}, rejected: [] };
  };
}

function phone(send: (r: SyncRequest) => Promise<SyncResponse>, userId: number, clock: () => string): SyncIO & { data: ModuleStates; since: string | null } {
  let ledger: Ledger = {};
  const p = {
    data: emptyStates(),
    since: null as string | null,
    states: () => p.data,
    apply: <M extends ModuleName>(m: M, fn: (s: ModuleStates[M]) => ModuleStates[M]) => {
      p.data = { ...p.data, [m]: fn(p.data[m]) };
    },
    ledger: { get: () => ledger, set: (l: Ledger) => (ledger = l) },
    send,
    ctx: { userId },
    now: clock,
  };
  return p;
}

describe('two phones', () => {
  test('milk added on one phone shows on the other after the next sync; the later edit wins', async () => {
    const server = fakeServer();
    let t = Date.parse(T1);
    const clock = () => new Date((t += 1000)).toISOString();
    const a = phone(server, 7, clock);
    const b = phone(server, 8, clock);

    a.data = { ...a.data, shopping: { ...a.data.shopping, items: [milk()] } };
    a.since = (await syncOnce(a, a.since)).since;
    b.since = (await syncOnce(b, b.since)).since;
    expect(b.data.shopping.items.map((i) => i.name)).toEqual(['Milk']);

    // Both change it while offline: A first, then B. B syncs first, A later, and B's change still wins
    a.data = { ...a.data, shopping: { ...a.data.shopping, items: [milk({ quantity: '1' })] } };
    a.ledger.set(observe(a.ledger.get(), 'shopping', a.data.shopping, a.ctx, clock())); // the app looks at every change as it happens
    b.data = { ...b.data, shopping: { ...b.data.shopping, items: [{ ...b.data.shopping.items[0], quantity: '3' }] } };
    b.ledger.set(observe(b.ledger.get(), 'shopping', b.data.shopping, b.ctx, clock()));

    b.since = (await syncOnce(b, b.since)).since;
    a.since = (await syncOnce(a, a.since)).since;
    expect(a.data.shopping.items[0].quantity).toBe('3');
    b.since = (await syncOnce(b, b.since)).since;
    expect(b.data.shopping.items[0].quantity).toBe('3');

    // B deletes it; A hears about it
    b.data = { ...b.data, shopping: { ...b.data.shopping, items: [] } };
    b.since = (await syncOnce(b, b.since)).since;
    a.since = (await syncOnce(a, a.since)).since;
    expect(a.data.shopping.items).toEqual([]);
  });
});
