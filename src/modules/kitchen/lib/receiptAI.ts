import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';

const Receipt = z.object({
  store: z.string(),
  /** YYYY-MM-DD, or empty if not printed */
  date: z.string(),
  currency: z.string(),
  total: z.number(),
  items: z.array(
    z.object({
      name: z.string(),
      quantity: z.string(),
      price: z.number(),
      category: z.enum(['food', 'drinks', 'cleaning', 'bathroom', 'home', 'pet', 'other']),
      location: z.enum(['fridge', 'freezer', 'pantry', 'bathroom', 'cleaning', 'other']),
      shelf_life_days: z.number(),
    }),
  ),
});

export type Receipt = z.infer<typeof Receipt>;

const SYSTEM = `You read supermarket receipts for a home-inventory app.
Return every product line as a clear, everyday item name in English (e.g. "ALPRO SOYA 1L" becomes "Soy milk",
"BAN. FAIRTR." becomes "Bananas"), keeping the quantity/size as printed (e.g. "1 L", "6 pack", "2 x").
Skip bags, deposits, discounts and loyalty lines, but use the discounted price when a discount applies to an item.
Choose where each item is normally stored at home, and estimate its typical shelf life in days from purchase
when stored there (use 0 for non-perishables like cleaning products, toiletries, tins or dry pasta).
Use an empty string for the date if it isn't printed. If the image is not a receipt, return no items and total 0.`;

export class ReceiptAIError extends Error {}

export async function readReceipt(
  apiKey: string,
  imageBase64: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/jpeg',
): Promise<Receipt> {
  // The user's own key, sent only to the Anthropic API.
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  try {
    const response = await client.beta.messages.parse({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: betaZodOutputFormat(Receipt) },
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
            { type: 'text', text: 'Read this receipt.' },
          ],
        },
      ],
    });
    if (response.stop_reason === 'refusal') throw new ReceiptAIError('The AI could not read this image. Try another photo.');
    if (!response.parsed_output) throw new ReceiptAIError('The AI reply could not be read. Please try again.');
    return response.parsed_output;
  } catch (error) {
    if (error instanceof ReceiptAIError) throw error;
    if (error instanceof Anthropic.AuthenticationError) throw new ReceiptAIError('Your Anthropic API key was rejected. Check it in Settings.');
    if (error instanceof Anthropic.RateLimitError) throw new ReceiptAIError('Too many requests right now. Wait a minute and try again.');
    if (error instanceof Anthropic.APIConnectionError) throw new ReceiptAIError('No connection to the AI service. Check your internet.');
    if (error instanceof Anthropic.APIError) throw new ReceiptAIError(`AI service error (${error.status}). Please try again.`);
    throw error;
  }
}
