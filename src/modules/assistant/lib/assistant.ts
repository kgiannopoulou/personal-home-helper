import Anthropic from '@anthropic-ai/sdk';
import type { BetaMessageParam } from '@anthropic-ai/sdk/resources/beta/messages';
import type { makeTools } from './tools';

/**
 * Fixed on purpose: no dates or data here, so it's cached across requests.
 * Today's data arrives with each question instead.
 */
export const SYSTEM = `You are Home Helper, a personal life assistant inside the user's app. The app tracks their food and water, activity and running, kitchen inventory, shopping list, money, household chores, calendar, to-dos, life admin, birthdays, trips, weather and indoor air.

Each user message starts with <today>…</today>: a fresh summary of their data across every part of the app. Use look_up when you need more detail. Before it may come <memory>…</memory>: lasting facts you saved about them in earlier chats.

How to help:
- Connect the parts. A good answer often combines the calendar, food, weather, kitchen, chores and budget: suggest a snack before a workout, a dinner that uses food expiring soon, chores that fit the free time, or skipping fresh food before a trip.
- When the user tells you something happened or asks you to do something ("I finished the milk", "add eggs", "I drank a glass of water", "remind me to call the dentist", "I spent €12 on lunch"), do it with the tools straight away, then confirm in one short line. Don't ask for permission for these small, reversible actions.
- If a request is ambiguous in a way that matters (which day, how much), ask one short question instead of guessing.
- Plans ("plan my day", "plan next week"): give a short timeline with times that fit around their calendar, meals, workouts, chores and errands. Don't add things to the app unless they ask.
- Memory: use what you remember naturally, without announcing it. When they tell you something lasting about themselves (a like or dislike, allergy or diet, routine, goal, someone close to them), save it with remember, without asking. Save health details only when they matter for food or exercise advice. When a fact changes or they ask you to forget, use forget (then remember the new version). Never save passwords, card numbers or similar.
- Only use what the data shows; don't invent events, items or numbers. If something isn't tracked, say so.
- Food advice must respect their diet (vegetarian/vegan) when known. You're not a doctor: for pain, illness or medical questions, suggest seeing a professional.

Style: they read this on a phone. Be warm and brief: usually 1–5 short lines or a few bullets. Plain text with simple bullets, no tables or headings. Use their currency and 24-hour times.`;

export class AssistantError extends Error {}

export interface AskResult {
  /** The full conversation, including tool calls, to send next time */
  history: BetaMessageParam[];
  reply: string;
}

/** Wraps what's remembered, today's data and the question into one user turn. */
export function userTurn(context: string, question: string, memory = ''): BetaMessageParam {
  const remembered = memory ? `<memory>\n${memory}\n</memory>\n` : '';
  return { role: 'user', content: `${remembered}<today>\n${context}\n</today>\n\n${question}` };
}

export async function ask(
  apiKey: string,
  history: BetaMessageParam[],
  context: string,
  question: string,
  tools: ReturnType<typeof makeTools>,
  /** Remembered facts as text (memoryText), empty for none */
  memory = '',
): Promise<AskResult> {
  // The user's own key, sent only to the Anthropic API.
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  try {
    const runner = client.beta.messages.toolRunner({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium' },
      // Caches the system prompt, tools and earlier turns; the conversation only ever grows.
      cache_control: { type: 'ephemeral' },
      system: SYSTEM,
      tools,
      messages: [...history, userTurn(context, question, memory)],
      max_iterations: 8,
    });
    const final = await runner;
    if (final.stop_reason === 'refusal') throw new AssistantError("I can't help with that one. Try asking differently.");
    const reply = final.content
      .filter((b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();
    return {
      history: [...runner.params.messages],
      reply: reply || (final.stop_reason === 'max_tokens' ? 'That got too long. Try a narrower question.' : 'Done.'),
    };
  } catch (error) {
    if (error instanceof AssistantError) throw error;
    if (error instanceof Anthropic.AuthenticationError) throw new AssistantError('Your Anthropic API key was rejected. Tap “Change key” below to fix it.');
    if (error instanceof Anthropic.RateLimitError) throw new AssistantError('Too many requests right now. Wait a minute and try again.');
    if (error instanceof Anthropic.APIConnectionError) throw new AssistantError('No connection to the AI service. Check your internet.');
    if (error instanceof Anthropic.APIError) throw new AssistantError(`AI service error (${error.status}). Please try again.`);
    throw error;
  }
}
