import { afterEach, describe, expect, jest, test } from '@jest/globals';
import { ask, AssistantError, SYSTEM } from '../../src/modules/assistant/lib/assistant';
import type { Actions } from '../../src/modules/assistant/lib/catalog';
import { memoryBox } from '../../src/modules/assistant/lib/memory';
import { makeTools, type ActionLog } from '../../src/modules/assistant/lib/tools';

const noMemory = memoryBox(() => [], () => {});

/** Scripted Messages API replies, one per request. */
function stubApi(replies: object[], status = 200) {
  const requests: { headers: Record<string, string>; body: any }[] = [];
  const fetchMock = jest.fn(async (_url: unknown, init?: any) => {
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((v, k) => (headers[k] = v));
    requests.push({ headers, body: JSON.parse(init.body) });
    const reply = replies[Math.min(requests.length - 1, replies.length - 1)];
    return new Response(JSON.stringify(reply), { status, headers: { 'content-type': 'application/json', 'request-id': 'req_test' } });
  });
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return requests;
}

const message = (content: object[], stop_reason: string) => ({
  id: 'msg_' + Math.random().toString(36).slice(2),
  type: 'message',
  role: 'assistant',
  model: 'claude-opus-5-5',
  content,
  stop_reason,
  stop_sequence: null,
  usage: { input_tokens: 10, output_tokens: 10 },
});

const actions = { addToShopping: jest.fn((items: string[]) => `Added ${items.join(', ')} to the shopping list.`) } as unknown as Actions;

describe('assistant loop', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  test('runs the tool Claude asks for, then returns the reply and the full history', async () => {
    const requests = stubApi([
      message([{ type: 'tool_use', id: 'toolu_1', name: 'add_to_shopping_list', input: { items: ['Milk'] } }], 'tool_use'),
      message([{ type: 'text', text: 'Milk is on your list ✓' }], 'end_turn'),
    ]);
    const log: ActionLog[] = [];
    const result = await ask('sk-test', [], 'Now: Thursday 15 October 2026, 15:00', 'I finished the milk', makeTools(actions, (e) => log.push(e), noMemory));

    expect(result.reply).toBe('Milk is on your list ✓');
    expect(actions.addToShopping).toHaveBeenCalledWith(['Milk']);
    expect(log).toEqual([{ tool: 'add_to_shopping_list', result: 'Added Milk to the shopping list.' }]);

    // What we send: model, effort, caching, fallbacks, a fixed system prompt and today's data in the user turn.
    const first = requests[0];
    expect(first.body).toMatchObject({ model: 'claude-opus-5-5', output_config: { effort: 'medium' }, cache_control: { type: 'ephemeral' }, fallbacks: 'default', system: SYSTEM });
    expect(first.headers['anthropic-beta']).toContain('server-side-fallback-2026-07-01');
    expect(first.body.tools).toHaveLength(16);
    expect(first.body.messages).toEqual([{ role: 'user', content: '<today>\nNow: Thursday 15 October 2026, 15:00\n</today>\n\nI finished the milk' }]);

    // The second request carries the tool result back.
    expect(requests[1].body.messages[2]).toMatchObject({ role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content: 'Added Milk to the shopping list.' }] });

    // History is append-only: question, tool call, tool result, reply.
    expect(result.history.map((m) => m.role)).toEqual(['user', 'assistant', 'user', 'assistant']);
  });

  test('the next question is appended to the earlier history unchanged', async () => {
    const requests = stubApi([message([{ type: 'text', text: 'You have 2 to-dos.' }], 'end_turn')]);
    const earlier = [
      { role: 'user' as const, content: '<today>\nA\n</today>\n\nhi' },
      { role: 'assistant' as const, content: [{ type: 'text' as const, text: 'Hello!' }] },
    ];
    const result = await ask('sk-test', earlier, 'B', 'What do I need to do?', makeTools(actions, () => {}, noMemory));
    expect(requests[0].body.messages.slice(0, 2)).toEqual(earlier);
    expect(result.history).toHaveLength(4);
  });

  test('a rejected key becomes a friendly message', async () => {
    stubApi([{ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }], 401);
    await expect(ask('bad', [], 'A', 'hi', makeTools(actions, () => {}, noMemory))).rejects.toThrow(AssistantError);
  });

  test('a refusal is reported, not shown as an empty reply', async () => {
    stubApi([message([], 'refusal')]);
    await expect(ask('sk-test', [], 'A', 'hi', makeTools(actions, () => {}, noMemory))).rejects.toThrow("I can't help with that one");
  });
});
