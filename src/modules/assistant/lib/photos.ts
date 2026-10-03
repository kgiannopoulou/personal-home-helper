import type { BetaMessageParam } from '@anthropic-ai/sdk/resources/beta/messages';

/** A photo attached to a chat message, ready to send. */
export interface Photo {
  /** Local file, only for showing it in the chat */
  uri: string;
  base64: string;
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp';
}

/** Longest side sent to Claude; bigger photos are scaled down to this anyway. */
export const MAX_SIDE = 1568;

/** Scaled size that keeps the aspect ratio, or null when the photo is small enough already. */
export function fitWithin(width: number, height: number, max = MAX_SIDE): { width: number } | { height: number } | null {
  if (Math.max(width, height) <= max) return null;
  return width >= height ? { width: max } : { height: max };
}

const REF = 'photo-ref:';

/** Short, stable id for a photo's data (FNV-1a), so the same photo is stored once. */
export function photoId(data: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < data.length; i++) {
    h ^= data.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `${(h >>> 0).toString(36)}${data.length.toString(36)}`;
}

type Block = { type: string; source?: { type: string; data?: string } };
const isPhoto = (b: Block) => b.type === 'image' && b.source?.type === 'base64' && typeof b.source.data === 'string';

/**
 * Photos are large, so the saved chat keeps a reference and each photo is saved on its own.
 * Loading puts the exact same data back: the history sent to Claude must never change.
 */
export function packHistory(history: BetaMessageParam[]): { history: BetaMessageParam[]; photos: Record<string, string> } {
  const photos: Record<string, string> = {};
  const packed = history.map((m) => {
    if (typeof m.content === 'string' || !m.content.some((b) => isPhoto(b as Block))) return m;
    return {
      ...m,
      content: m.content.map((b) => {
        const block = b as Block;
        if (!isPhoto(block) || block.source!.data!.startsWith(REF)) return b;
        const id = photoId(block.source!.data!);
        photos[id] = block.source!.data!;
        return { ...b, source: { ...block.source, data: REF + id } };
      }),
    } as BetaMessageParam;
  });
  return { history: packed, photos };
}

/** Puts the saved photos back. Null if one is missing, so the caller can start a new chat instead. */
export function unpackHistory(history: BetaMessageParam[], load: (id: string) => string | undefined): BetaMessageParam[] | null {
  let missing = false;
  const out = history.map((m) => {
    if (typeof m.content === 'string') return m;
    return {
      ...m,
      content: m.content.map((b) => {
        const block = b as Block;
        const data = block.source?.data;
        if (!isPhoto(block) || !data!.startsWith(REF)) return b;
        const real = load(data!.slice(REF.length));
        if (real === undefined) missing = true;
        return { ...b, source: { ...block.source, data: real ?? '' } };
      }),
    } as BetaMessageParam;
  });
  return missing ? null : out;
}

/** Ids of the photos a saved history refers to. */
export function photoRefs(history: BetaMessageParam[]): string[] {
  const ids: string[] = [];
  for (const m of history) {
    if (typeof m.content === 'string') continue;
    for (const b of m.content) {
      const data = (b as Block).source?.data;
      if (isPhoto(b as Block) && data!.startsWith(REF)) ids.push(data!.slice(REF.length));
    }
  }
  return ids;
}
