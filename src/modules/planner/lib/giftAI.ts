import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';

const Gifts = z.object({
  ideas: z.array(
    z.object({
      idea: z.string(),
      why: z.string(),
      price_estimate: z.number(),
    }),
  ),
});

const SYSTEM = `You suggest thoughtful, specific birthday gifts for a personal planner app.
Give 5 varied ideas (mix physical gifts and experiences) that fit the person's interests and stay within the budget
when one is given. Keep each idea short and concrete (e.g. "Japanese ceramic herb planter set", not "something for
the garden"), with a one-sentence reason and a realistic price estimate in the given currency.`;

export class GiftAIError extends Error {}

export async function suggestGifts(
  apiKey: string,
  person: { name: string; interests: string; budget?: number; turning?: number },
  currency: string,
): Promise<string[]> {
  // The user's own key, sent only to the Anthropic API.
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  const details = [
    `Name: ${person.name}`,
    `Interests: ${person.interests || 'not given'}`,
    person.turning ? `Turning: ${person.turning}` : null,
    person.budget ? `Budget: about ${currency.trim()}${person.budget}` : null,
    `Currency: ${currency.trim()}`,
  ]
    .filter(Boolean)
    .join('\n');
  try {
    const response = await client.beta.messages.parse({
      model: 'claude-opus-5-5',
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: betaZodOutputFormat(Gifts) },
      system: SYSTEM,
      messages: [{ role: 'user', content: `Suggest birthday gifts.\n\n${details}` }],
    });
    if (response.stop_reason === 'refusal') throw new GiftAIError('The AI could not suggest gifts for this. Try different interests.');
    if (!response.parsed_output) throw new GiftAIError('The AI reply could not be read. Please try again.');
    return response.parsed_output.ideas.map((g) => `${g.idea} (~${currency.trim()}${Math.round(g.price_estimate)}): ${g.why}`);
  } catch (error) {
    if (error instanceof GiftAIError) throw error;
    if (error instanceof Anthropic.AuthenticationError) throw new GiftAIError('Your Anthropic API key was rejected. Check it in Settings.');
    if (error instanceof Anthropic.RateLimitError) throw new GiftAIError('Too many requests right now. Wait a minute and try again.');
    if (error instanceof Anthropic.APIConnectionError) throw new GiftAIError('No connection to the AI service. Check your internet.');
    if (error instanceof Anthropic.APIError) throw new GiftAIError(`AI service error (${error.status}). Please try again.`);
    throw error;
  }
}
