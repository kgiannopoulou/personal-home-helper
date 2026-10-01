import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import type { Diet } from './types';

const MealEstimate = z.object({
  items: z.array(
    z.object({
      name: z.string(),
      grams: z.number(),
      kcal: z.number(),
      protein: z.number(),
      carbs: z.number(),
      fat: z.number(),
      fiber: z.number(),
    }),
  ),
  confidence: z.enum(['low', 'medium', 'high']),
  notes: z.string(),
});

export type MealEstimate = z.infer<typeof MealEstimate>;

export interface MealInput {
  /** Base64 JPEG/PNG from the camera or gallery */
  imageBase64?: string;
  mediaType?: 'image/jpeg' | 'image/png' | 'image/webp';
  /** Free text, e.g. "2 eggs, a slice of toast and a coffee with milk" */
  text?: string;
  diet: Diet;
}

const SYSTEM = `You are a nutrition assistant inside a food-tracking app.
Identify each food or drink the user had and estimate its portion in grams and its nutrients
(kcal, protein, carbs, fat, fiber in grams) for that portion. Use typical recipes and portion
sizes when something is unclear, and say what you assumed in "notes" (one or two short sentences).
Plain water has no nutrients, so leave it out. If the photo shows no food, return an empty list and explain in notes.`;

export class MealAIError extends Error {}

export async function estimateMeal(apiKey: string, input: MealInput): Promise<MealEstimate> {
  if (!input.imageBase64 && !input.text?.trim()) throw new MealAIError('Add a photo or describe what you ate.');

  // The key belongs to the user and never leaves their device except to call the API.
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (input.imageBase64) {
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: input.mediaType ?? 'image/jpeg', data: input.imageBase64 },
    });
  }
  content.push({
    type: 'text',
    text: `${input.text?.trim() || 'What is in this meal?'}\n\n(The user is ${input.diet}.)`,
  });

  try {
    const response = await client.beta.messages.parse({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: betaZodOutputFormat(MealEstimate) },
      system: SYSTEM,
      messages: [{ role: 'user', content }],
    });
    if (response.stop_reason === 'refusal') throw new MealAIError('The AI could not analyse this meal. Try describing it instead.');
    if (!response.parsed_output) throw new MealAIError('The AI reply could not be read. Please try again.');
    return response.parsed_output;
  } catch (error) {
    if (error instanceof MealAIError) throw error;
    if (error instanceof Anthropic.AuthenticationError) throw new MealAIError('Your Anthropic API key was rejected. Check it in Profile.');
    if (error instanceof Anthropic.RateLimitError) throw new MealAIError('Too many requests right now. Wait a minute and try again.');
    if (error instanceof Anthropic.APIConnectionError) throw new MealAIError('No connection to the AI service. Check your internet.');
    if (error instanceof Anthropic.APIError) throw new MealAIError(`AI service error (${error.status}). Please try again.`);
    throw error;
  }
}
