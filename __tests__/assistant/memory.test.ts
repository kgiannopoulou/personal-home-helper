import { describe, expect, test } from '@jest/globals';
import { forgetFact, MAX_FACTS, memoryBox, memoryText, rememberFact, removeFact, type Fact } from '../../src/modules/assistant/lib/memory';
import type { Actions } from '../../src/modules/assistant/lib/catalog';
import { makeTools, type ActionLog } from '../../src/modules/assistant/lib/tools';

const fact = (text: string, kind: Fact['kind'] = 'preference'): Fact => ({ id: text, text, kind, added: '2026-10-01' });

describe('remembering', () => {
  test('saves a fact with its kind and date', () => {
    const { facts, result } = rememberFact([], '  Doesn’t like   mushrooms ', 'preference', '2026-10-02');
    expect(result).toBe('Remembered: Doesn’t like mushrooms');
    expect(facts).toEqual([{ id: expect.any(String), text: 'Doesn’t like mushrooms', kind: 'preference', added: '2026-10-02' }]);
  });

  test('the same fact twice is kept once (case and punctuation ignored)', () => {
    const before = [fact('Vegetarian')];
    const { facts, result } = rememberFact(before, 'vegetarian.', 'health');
    expect(facts).toBe(before);
    expect(result).toBe('Already remembered: vegetarian.');
  });

  test('a full memory says so instead of dropping old facts', () => {
    const full = Array.from({ length: MAX_FACTS }, (_, i) => fact(`Fact ${i}`));
    const { facts, result } = rememberFact(full, 'One more', 'other');
    expect(facts).toBe(full);
    expect(result).toMatch(/Memory is full/);
  });
});

describe('forgetting', () => {
  const facts = [fact('Gym on Tuesday evenings', 'routine'), fact('Sister Anna likes gardening', 'person'), fact('Hates gym music')];

  test('forgets every fact containing the words', () => {
    const change = forgetFact(facts, 'GYM');
    expect(change.facts.map((f) => f.text)).toEqual(['Sister Anna likes gardening']);
    expect(change.result).toBe('Forgot: Gym on Tuesday evenings; Hates gym music');
  });

  test('says when nothing matches', () => {
    const change = forgetFact(facts, 'cats');
    expect(change.facts).toBe(facts);
    expect(change.result).toBe('Nothing remembered about "cats".');
  });

  test('removes one fact by id from the memory screen', () => {
    expect(removeFact(facts, 'Hates gym music')).toHaveLength(2);
  });
});

test('memory text groups facts by kind and is empty without facts', () => {
  expect(memoryText([])).toBe('');
  expect(memoryText([fact('Vegetarian'), fact('Runs on Sundays', 'routine'), fact('No mushrooms')])).toBe(
    'preference: Vegetarian; No mushrooms\nroutine: Runs on Sundays',
  );
});

test('the remember and forget tools change memory and show in the chat', async () => {
  let facts: Fact[] = [];
  const box = memoryBox(
    () => facts,
    (next) => (facts = next),
  );
  const log: ActionLog[] = [];
  type AnyTool = { name: string; run: (input: any) => Promise<unknown>; parse: (input: unknown) => any };
  const tools = Object.fromEntries((makeTools({} as Actions, (e) => log.push(e), box) as AnyTool[]).map((t) => [t.name, t]));

  // Two calls in one answer build on each other.
  await tools.remember.run(tools.remember.parse({ fact: 'Vegetarian', kind: 'health' }));
  await tools.remember.run(tools.remember.parse({ fact: 'Gym on Thursdays', kind: 'routine' }));
  expect(facts.map((f) => f.text)).toEqual(['Vegetarian', 'Gym on Thursdays']);

  await tools.forget.run(tools.forget.parse({ about: 'gym' }));
  expect(facts.map((f) => f.text)).toEqual(['Vegetarian']);
  expect(log.map((e) => e.result)).toEqual(['Remembered: Vegetarian', 'Remembered: Gym on Thursdays', 'Forgot: Gym on Thursdays']);

  expect(() => tools.remember.parse({ fact: 'x', kind: 'preference' })).toThrow();
  expect(() => tools.remember.parse({ fact: 'Likes tea', kind: 'secret' })).toThrow();
});
