import { afterEach, describe, expect, jest, test } from '@jest/globals';
import { AssistantError } from '../../src/modules/assistant/lib/assistant';
import {
  BRIEFING_SYSTEM,
  briefingTarget,
  briefingTurn,
  makeBriefing,
  makeReview,
  nudgeLines,
  REVIEW_SYSTEM,
  reviewTurn,
  reviewWeek,
  type ProactiveInput,
} from '../../src/modules/assistant/lib/proactive';

/** Scripted Messages API replies, one per request. */
function stubApi(replies: object[]) {
  const requests: { headers: Record<string, string>; body: any }[] = [];
  globalThis.fetch = jest.fn(async (_url: unknown, init?: any) => {
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((v, k) => (headers[k] = v));
    requests.push({ headers, body: JSON.parse(init.body) });
    const reply = replies[Math.min(requests.length - 1, replies.length - 1)];
    return new Response(JSON.stringify(reply), { status: 200, headers: { 'content-type': 'application/json', 'request-id': 'req_test' } });
  }) as unknown as typeof fetch;
  return requests;
}

const json = (value: object, stop_reason = 'end_turn') => ({
  id: 'msg_1',
  type: 'message',
  role: 'assistant',
  model: 'claude-opus-5-5',
  content: [{ type: 'text', text: JSON.stringify(value) }],
  stop_reason,
  stop_sequence: null,
  usage: { input_tokens: 10, output_tokens: 10 },
});

const input: ProactiveInput = {
  today: 'Now: Thursday 15 October 2026, 08:00',
  calendarWeek: '2026-10-15: 18:00–19:00 Gym',
  forecast: '2026-10-15: Rain, 9–14°C, rain 80%',
  history: { money: 'Spent €300', food: 'Water 1500 ml', activity: 'Sleep 6.5 h', chores: 'Slipping: Vacuum' },
  memory: '- Vegetarian',
};

describe('when the assistant speaks up', () => {
  test('the briefing is for today, or for tomorrow from the evening (so it fits the morning notification)', () => {
    expect(briefingTarget(new Date(2026, 9, 15, 8))).toEqual({ date: '2026-10-15', tomorrow: false });
    expect(briefingTarget(new Date(2026, 9, 15, 21))).toEqual({ date: '2026-10-16', tomorrow: true });
  });

  test('the weekly review is on Sunday, or Monday if Sunday was missed', () => {
    expect(reviewWeek(new Date(2026, 9, 18, 10))).toBe('2026-10-12'); // Sunday: this week
    expect(reviewWeek(new Date(2026, 9, 19, 10))).toBe('2026-10-12'); // Monday: last week
    expect(reviewWeek(new Date(2026, 9, 15, 10))).toBeNull();
  });
});

describe('prompts', () => {
  test('fixed system prompts (no dates), with the data in the user turn', () => {
    expect(BRIEFING_SYSTEM).not.toMatch(/20\d\d/);
    expect(REVIEW_SYSTEM).not.toMatch(/20\d\d/);
    const turn = briefingTurn(input, { date: '2026-10-15', tomorrow: false });
    expect(turn).toContain('<memory>\n- Vegetarian\n</memory>');
    expect(turn).toContain('<calendar_next_7_days>\n2026-10-15: 18:00–19:00 Gym');
    expect(turn).toContain('Chores:\nSlipping: Vacuum');
    expect(turn).toMatch(/Write the 3 nudges for today, Thursday 15 October 2026\.$/);
    expect(briefingTurn(input, { date: '2026-10-16', tomorrow: true })).toContain('for tomorrow, Friday 16 October 2026');
  });

  test('the review covers the week and plans the next one', () => {
    const turn = reviewTurn({ ...input, kitchen: 'Spinach: full, fridge, expires in 2 days' }, '2026-10-12', new Date(2026, 9, 18, 10));
    expect(turn).toContain('<kitchen>\nSpinach');
    expect(turn).toMatch(/Review the week of 2026-10-12 to 2026-10-18 .* then plan next week: 2026-10-19 to 2026-10-25\.$/);
  });
});

describe('calls', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  test('daily briefing: one low-effort call with a JSON schema, cut to 3 nudges', async () => {
    const nudges = [1, 2, 3, 4].map((n) => ({ emoji: '💧', text: `Nudge ${n}`, module: 'food' }));
    const requests = stubApi([json({ nudges })]);
    const b = await makeBriefing('sk-test', input, new Date(2026, 9, 15, 8));
    expect(b).toEqual({ date: '2026-10-15', nudges: nudges.slice(0, 3) });
    expect(nudgeLines(b)).toEqual(['💧 Nudge 1', '💧 Nudge 2', '💧 Nudge 3']);

    const { body, headers } = requests[0];
    expect(body).toMatchObject({ model: 'claude-opus-5-5', system: BRIEFING_SYSTEM, cache_control: { type: 'ephemeral' }, fallbacks: 'default' });
    expect(body.output_config.effort).toBe('low');
    expect(body.output_config.format.type).toBe('json_schema');
    expect(headers['anthropic-beta']).toContain('server-side-fallback-2026-07-01');
    expect(body.messages).toHaveLength(1);
  });

  test('weekly review: the plan is only kept when it has changes', async () => {
    const review = { headline: 'Good week', budget: 'On pace', nutrition: 'Low fibre', chores: 'Vacuum slipped' };
    stubApi([
      json({
        ...review,
        plan: { title: 'Next week', summary: 'Runs before work', changes: [{ kind: 'event', title: '🏃 Run', date: '2026-10-20', start: '07:00' }] },
      }),
    ]);
    const withPlan = await makeReview('sk-test', input, '2026-10-12', new Date(2026, 9, 18, 10));
    expect(withPlan).toMatchObject({ week: '2026-10-12', ...review, plan: { title: 'Next week', id: expect.any(String) } });

    const requests = stubApi([json({ ...review, plan: { title: 'Next week', summary: 'Nothing new', changes: [] } })]);
    expect((await makeReview('sk-test', input, '2026-10-12')).plan).toBeNull();
    expect(requests[0].body.output_config.effort).toBe('medium');
    expect(requests[0].body.system).toBe(REVIEW_SYSTEM);
  });

  test('a refusal becomes a friendly error', async () => {
    stubApi([{ ...json({}), content: [], stop_reason: 'refusal' }]);
    await expect(makeBriefing('sk-test', input)).rejects.toBeInstanceOf(AssistantError);
  });
});
