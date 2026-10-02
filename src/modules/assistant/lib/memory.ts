import { newId, toDateKey } from '../../../shared/dates';

export const FACT_KINDS = ['preference', 'routine', 'goal', 'person', 'health', 'other'] as const;
export type FactKind = (typeof FACT_KINDS)[number];

/** Something lasting about the user, kept across chats: "Doesn't like mushrooms", "Gym on Tue and Thu". */
export interface Fact {
  id: string;
  text: string;
  kind: FactKind;
  /** YYYY-MM-DD it was saved */
  added: string;
}

/** Enough for a person's habits and tastes, small enough to send with every question. */
export const MAX_FACTS = 60;
const MAX_LENGTH = 200;

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

export interface Change {
  facts: Fact[];
  /** A short sentence saying what happened, for the assistant and the chat */
  result: string;
}

export function rememberFact(facts: Fact[], text: string, kind: FactKind, today = toDateKey()): Change {
  const clean = text.trim().replace(/\s+/g, ' ').slice(0, MAX_LENGTH);
  if (!clean) return { facts, result: 'Nothing to remember.' };
  if (facts.some((f) => norm(f.text) === norm(clean))) return { facts, result: `Already remembered: ${clean}` };
  if (facts.length >= MAX_FACTS) {
    return { facts, result: `Memory is full (${MAX_FACTS} facts). Ask the user which to forget first.` };
  }
  return { facts: [...facts, { id: newId(), text: clean, kind, added: today }], result: `Remembered: ${clean}` };
}

/** Forgets the facts that contain what the user said, e.g. "mushrooms" or "gym". */
export function forgetFact(facts: Fact[], about: string): Change {
  const key = norm(about);
  if (!key) return { facts, result: 'Nothing to forget.' };
  const gone = facts.filter((f) => norm(f.text).includes(key));
  if (!gone.length) return { facts, result: `Nothing remembered about "${about.trim()}".` };
  return {
    facts: facts.filter((f) => !gone.includes(f)),
    result: `Forgot: ${gone.map((f) => f.text).join('; ')}`,
  };
}

export const removeFact = (facts: Fact[], id: string) => facts.filter((f) => f.id !== id);

/** The facts as plain text, grouped by kind, for the start of each question. Empty without facts. */
export function memoryText(facts: Fact[]): string {
  return FACT_KINDS.flatMap((kind) => {
    const of = facts.filter((f) => f.kind === kind);
    return of.length ? [`${kind}: ${of.map((f) => f.text).join('; ')}`] : [];
  }).join('\n');
}

/** Holds the facts while the assistant works, so several remember/forget calls in one answer build on each other. */
export interface MemoryBox {
  remember(text: string, kind: FactKind): string;
  forget(about: string): string;
}

export function memoryBox(get: () => Fact[], set: (facts: Fact[]) => void): MemoryBox {
  const apply = (change: Change) => {
    if (change.facts !== get()) set(change.facts);
    return change.result;
  };
  return {
    remember: (text, kind) => apply(rememberFact(get(), text, kind)),
    forget: (about) => apply(forgetFact(get(), about)),
  };
}
