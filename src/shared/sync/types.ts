import type { AppState as ActivityState } from '../../modules/activity/lib/types';
import type { AppState as ChoresState } from '../../modules/chores/lib/types';
import type { AppState as FoodState } from '../../modules/food/lib/types';
import type { AppState as KitchenState } from '../../modules/kitchen/lib/types';
import type { AppState as MoneyState } from '../../modules/money/lib/types';
import type { AppState as PlannerState } from '../../modules/planner/lib/types';
import type { AppState as ShoppingState } from '../../modules/shopping/lib/types';

/** The modules whose records are shared through the server. */
export interface ModuleStates {
  money: MoneyState;
  kitchen: KitchenState;
  shopping: ShoppingState;
  chores: ChoresState;
  food: FoodState;
  activity: ActivityState;
  planner: PlannerState;
}

export type ModuleName = keyof ModuleStates;

/** A row as the server sends and takes it: snake_case, ISO times, a server collection name. */
export interface Row {
  id: string;
  updated_at: string;
  deleted_at?: string | null;
  [field: string]: unknown;
}

/**
 * What this phone knows about one record since the last sync. The records themselves
 * stay as the modules keep them; the ledger holds the sync facts:
 * - hash: of the record as the server sees it, to spot a change
 * - updatedAt: when it last changed (here, or on the server), for last write wins
 * - deleted: a tombstone, the record is gone here and the server must hear about it
 * - dirty: changed here and not yet accepted by the server
 * - order: for collections the module trims (oldest first), to tell trimming from deleting
 */
export interface LedgerEntry {
  hash: string;
  updatedAt: string;
  deleted?: boolean;
  dirty?: boolean;
  order?: string;
  /** Why the server refused it; it isn't sent again until it changes */
  rejected?: string;
}

/** collection → record id → entry */
export type Ledger = Record<string, Record<string, LedgerEntry>>;

export interface SyncRequest {
  since: string | null;
  changes: Record<string, Row[]>;
}

export interface SyncResponse {
  since: string;
  changes: Record<string, Row[]>;
  /** Records the server joined to one it already had ("Kitchen" made on two phones): collection → old id → id */
  remapped: Record<string, Record<string, string>>;
  rejected: { collection: string; id: string; reason: 'invalid' | 'forbidden' | 'conflict'; errors?: Record<string, string[]> }[];
}

/** Who this phone is on the server. */
export interface SyncContext {
  userId: number;
}
