/**
 * Sync rules, as pure functions over the module states and the ledger (see types.ts):
 *
 * - observe: compare each record with what the ledger last saw. A new or changed record gets
 *   updatedAt = now and is marked dirty; a record that's gone becomes a tombstone.
 * - pending: the dirty records and tombstones, as server rows.
 * - acknowledge: the server took them (or refused them): they're no longer dirty.
 * - mergeModule: put the server's rows into a module, last write wins. A row older than a change
 *   still waiting here is skipped; that change goes up on the next sync and wins there too.
 *
 * syncOnce strings them together around one request. It has no React Native in it, so the same
 * code runs in the app (SyncProvider), in Jest, and against a real server (scripts/sync-smoke.ts).
 */
import { COLLECTIONS, COLLECTION_BY_NAME, type Collection } from './collections';
import { hashOf } from './hash';
import type { Ledger, LedgerEntry, ModuleName, ModuleStates, Row, SyncContext, SyncRequest, SyncResponse } from './types';

type AnyRecord = { id: string } & Record<string, unknown>;

export const MODULES: ModuleName[] = ['money', 'kitchen', 'shopping', 'chores', 'food', 'activity', 'planner'];

const collectionsOf = (module: ModuleName) => COLLECTIONS.filter((c) => c.module === module);

// Records are immutable, so a record object keeps its hash: only changed records are hashed again.
const hashes = new WeakMap<object, string>();
function recordHash(c: Collection, r: AnyRecord, ctx: SyncContext): string {
  let h = hashes.get(r);
  if (h === undefined) {
    h = hashOf(c.toRow(r, ctx));
    hashes.set(r, h);
  }
  return h;
}

const time = (iso: string) => Date.parse(iso);

/** Notice what changed in one module since the ledger last looked. */
export function observe<M extends ModuleName>(ledger: Ledger, module: M, state: ModuleStates[M], ctx: SyncContext, now: string): Ledger {
  let next = ledger;
  for (const c of collectionsOf(module)) {
    const records = c.get(state, ctx) as AnyRecord[];
    const entries: Record<string, LedgerEntry> = { ...(ledger[c.name] ?? {}) };
    let changed = false;
    const here = new Set<string>();

    for (const r of records) {
      here.add(r.id);
      const hash = recordHash(c, r, ctx);
      const e = entries[r.id];
      if (!e || e.deleted || e.hash !== hash) {
        entries[r.id] = { hash, updatedAt: now, dirty: true, ...(c.trimmedBy ? { order: c.trimmedBy(r) } : {}) };
        changed = true;
      }
    }

    const oldestKept = c.trimmedBy && records.length ? records.map((r) => c.trimmedBy!(r)).sort()[0] : undefined;
    for (const [id, e] of Object.entries(entries)) {
      if (here.has(id) || e.deleted) continue;
      if (oldestKept !== undefined && e.order !== undefined && e.order < oldestKept) {
        delete entries[id]; // trimmed by the module to keep the list short: not a deletion
      } else {
        entries[id] = { hash: e.hash, updatedAt: now, deleted: true, dirty: true };
      }
      changed = true;
    }

    if (changed) next = { ...next, [c.name]: entries };
  }
  return next;
}

export type Sent = Record<string, Record<string, LedgerEntry>>;

/** The changes waiting to go up, and what was sent (to acknowledge against). */
export function pending(ledger: Ledger, states: ModuleStates, ctx: SyncContext): { changes: SyncRequest['changes']; sent: Sent } {
  const changes: SyncRequest['changes'] = {};
  const sent: Sent = {};
  for (const c of COLLECTIONS) {
    const entries = ledger[c.name] ?? {};
    const dirty = Object.entries(entries).filter(([, e]) => e.dirty);
    if (!dirty.length) continue;
    const byId = new Map((c.get(states[c.module] as never, ctx) as AnyRecord[]).map((r) => [r.id, r]));
    const rows: Row[] = [];
    for (const [id, e] of dirty) {
      if (e.deleted) {
        rows.push({ id, updated_at: e.updatedAt, deleted_at: e.updatedAt });
      } else {
        const r = byId.get(id);
        if (!r) continue; // gone since the last look: the next observe makes it a tombstone
        rows.push({ id, ...c.toRow(r, ctx), updated_at: e.updatedAt });
      }
      (sent[c.name] ??= {})[id] = e;
    }
    if (rows.length) changes[c.name] = rows;
  }
  return { changes, sent };
}

/** The server has the changes that were sent; any changed again since stay dirty. */
export function acknowledge(ledger: Ledger, sent: Sent, response: SyncResponse): Ledger {
  const next: Ledger = { ...ledger };
  for (const [name, ids] of Object.entries(sent)) {
    const entries = { ...(next[name] ?? {}) };
    for (const [id, was] of Object.entries(ids)) {
      const e = entries[id];
      if (!e || e.hash !== was.hash || Boolean(e.deleted) !== Boolean(was.deleted) || e.updatedAt !== was.updatedAt) continue;
      const refused = response.rejected.find((r) => r.collection === name && r.id === id);
      if (refused) entries[id] = { ...e, dirty: false, rejected: refused.reason };
      else if (e.deleted) delete entries[id]; // the server has the tombstone
      else entries[id] = { hash: e.hash, updatedAt: e.updatedAt, ...(e.order !== undefined ? { order: e.order } : {}) };
    }
    next[name] = entries;
  }
  return next;
}

/** Does the reply touch this module at all? */
export function touches(module: ModuleName, response: SyncResponse): boolean {
  return collectionsOf(module).some((c) => response.changes[c.name]?.length || Object.keys(response.remapped[c.name] ?? {}).length);
}

/** Put the server's reply into one module. */
export function mergeModule<M extends ModuleName>(
  state: ModuleStates[M],
  module: M,
  response: SyncResponse,
  ledger: Ledger,
  ctx: SyncContext,
): { state: ModuleStates[M]; ledger: Ledger } {
  let s = state;
  let l = ledger;
  const collections = collectionsOf(module);

  // 1. Records the server joined to one it already had take that one's id, and so do references to them
  for (const c of collections) {
    const renames = response.remapped[c.name];
    if (!renames || !Object.keys(renames).length) continue;
    const records = c.get(s, ctx) as AnyRecord[];
    const taken = new Set(records.map((r) => r.id));
    s = c.set(s as never, records.flatMap((r) => (renames[r.id] ? (taken.has(renames[r.id]) ? [] : [{ ...r, id: renames[r.id] }]) : [r])) as never) as ModuleStates[M];
    const entries = { ...(l[c.name] ?? {}) };
    for (const [from, to] of Object.entries(renames)) {
      if (entries[from]) entries[to] = entries[from];
      delete entries[from];
    }
    l = { ...l, [c.name]: entries };

    for (const d of collections) {
      const fields = Object.entries(d.references ?? {}).filter(([, target]) => target === c.name).map(([f]) => f);
      if (!fields.length) continue;
      const dEntries = { ...(l[d.name] ?? {}) };
      const updated = (d.get(s, ctx) as AnyRecord[]).map((r) => {
        const renamed = fields.filter((f) => typeof r[f] === 'string' && renames[r[f] as string]);
        if (!renamed.length) return r;
        const copy = { ...r, ...Object.fromEntries(renamed.map((f) => [f, renames[r[f] as string]])) };
        // The server renamed these too, so they aren't a change of ours
        if (dEntries[r.id]) dEntries[r.id] = { ...dEntries[r.id], hash: recordHash(d, copy, ctx) };
        return copy;
      });
      s = d.set(s as never, updated as never) as ModuleStates[M];
      l = { ...l, [d.name]: dEntries };
    }
  }

  // 2. The rows, last write wins
  for (const c of collections) {
    const rows = response.changes[c.name];
    if (!rows?.length) continue;
    const records = new Map((c.get(s, ctx) as AnyRecord[]).map((r) => [r.id, r]));
    const entries = { ...(l[c.name] ?? {}) };
    let changed = false;

    for (const row of rows) {
      const e = entries[row.id];
      const here = records.get(row.id);
      // Rows near the last sync come twice (the server starts a few seconds early): nothing to do
      const alreadyHave = row.deleted_at ? !here && !e : here && e && !e.dirty && e.updatedAt === row.updated_at;
      const changedHereUnseen = here && e && recordHash(c, here, ctx) !== e.hash;
      const newerHere = e?.dirty && time(e.updatedAt) > time(row.updated_at);
      if (alreadyHave || changedHereUnseen || newerHere) continue;

      if (row.deleted_at) {
        records.delete(row.id);
        delete entries[row.id];
      } else {
        const r = c.fromRow(row, here, ctx) as AnyRecord;
        records.set(row.id, r);
        entries[row.id] = { hash: recordHash(c, r, ctx), updatedAt: row.updated_at, ...(c.trimmedBy ? { order: c.trimmedBy(r) } : {}) };
      }
      changed = true;
    }
    if (!changed) continue;
    s = c.set(s as never, [...records.values()] as never) as ModuleStates[M];
    l = { ...l, [c.name]: entries };
  }

  // 3. A chore done on the other phone moves its "last done" here too
  if (module === 'chores' && response.changes.chore_completions?.length) {
    const chores = s as ModuleStates['chores'];
    const latest = new Map<string, string>();
    for (const done of chores.completions) if (done.at > (latest.get(done.taskId) ?? '')) latest.set(done.taskId, done.at);
    const tasks = chores.tasks.map((t) => {
      const at = latest.get(t.id);
      return at && (!t.lastDone || at > t.lastDone) ? { ...t, lastDone: at } : t;
    });
    if (tasks.some((t, i) => t !== chores.tasks[i])) s = { ...chores, tasks } as ModuleStates[M];
  }

  return { state: s, ledger: l };
}

export interface SyncIO {
  /** The modules as they are right now */
  states: () => ModuleStates;
  /** Change one module from its current state */
  apply: <M extends ModuleName>(module: M, fn: (state: ModuleStates[M]) => ModuleStates[M]) => void;
  ledger: { get: () => Ledger; set: (l: Ledger) => void };
  send: (request: SyncRequest) => Promise<SyncResponse>;
  ctx: SyncContext;
  now?: () => string;
}

/** One round trip. Returns the server's new "since" and what happened, for the status line. */
export async function syncOnce(io: SyncIO, since: string | null): Promise<{ since: string; sent: number; received: number; rejected: SyncResponse['rejected'] }> {
  const now = (io.now ?? (() => new Date().toISOString()))();
  let ledger = io.ledger.get();
  const states = io.states();
  for (const m of MODULES) ledger = observe(ledger, m, states[m] as never, io.ctx, now);
  io.ledger.set(ledger);

  const { changes, sent } = pending(ledger, states, io.ctx);
  const response = await io.send({ since, changes });

  io.ledger.set(acknowledge(io.ledger.get(), sent, response));
  for (const m of MODULES) {
    if (!touches(m, response)) continue;
    io.apply(m, (state) => {
      const r = mergeModule(state, m, response, io.ledger.get(), io.ctx);
      io.ledger.set(r.ledger);
      return r.state;
    });
  }

  return {
    since: response.since,
    sent: Object.values(changes).reduce((n, rows) => n + rows.length, 0),
    received: Object.values(response.changes).reduce((n, rows) => n + rows.length, 0),
    rejected: response.rejected,
  };
}

/** After signing in: the household's people are the chores module's members, and you are you. */
export function withHouseholdMembers(chores: ModuleStates['chores'], members: { id: number; name: string }[], me: number): ModuleStates['chores'] {
  return { ...chores, members: members.map((m) => ({ id: String(m.id), name: m.name })), meId: String(me) };
}

export { COLLECTION_BY_NAME };
