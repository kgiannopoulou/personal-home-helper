import { describe, expect, test } from '@jest/globals';
import type { BetaMessageParam } from '@anthropic-ai/sdk/resources/beta/messages';
import { userTurn } from '../../src/modules/assistant/lib/assistant';
import { fitWithin, packHistory, photoId, photoRefs, unpackHistory, type Photo } from '../../src/modules/assistant/lib/photos';

const photo: Photo = { uri: 'file:///fridge.jpg', base64: 'AAAA'.repeat(1000), mediaType: 'image/jpeg' };

describe('photos in the chat', () => {
  test('a photo goes first in the user turn, before today and the question', () => {
    expect(userTurn('Now: Thursday', 'Here’s a photo.', '', photo)).toEqual({
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: photo.base64 } },
        { type: 'text', text: '<today>\nNow: Thursday\n</today>\n\nHere’s a photo.' },
      ],
    });
  });

  test('big photos are scaled to 1568 px on the long side', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1568 });
    expect(fitWithin(3000, 4000)).toEqual({ height: 1568 });
    expect(fitWithin(1200, 900)).toBeNull();
  });

  test('saved chats keep a reference; loading restores exactly what was sent', () => {
    const history: BetaMessageParam[] = [
      userTurn('A', 'Here’s a photo.', '', photo),
      { role: 'assistant', content: [{ type: 'text', text: 'Milk is low.' }] },
      userTurn('B', 'thanks'),
    ];
    const { history: saved, photos } = packHistory(history);
    const id = photoId(photo.base64);
    expect(photos).toEqual({ [id]: photo.base64 });
    expect(JSON.stringify(saved)).not.toContain(photo.base64);
    expect(photoRefs(saved)).toEqual([id]);
    expect(unpackHistory(saved, (x) => photos[x])).toEqual(history);
    // Packing twice changes nothing.
    expect(packHistory(saved).history).toEqual(saved);
  });

  test('a lost photo means the chat cannot continue unchanged', () => {
    const { history } = packHistory([userTurn('A', 'photo', '', photo)]);
    expect(unpackHistory(history, () => undefined)).toBeNull();
  });

  test('photo ids are stable and differ between photos', () => {
    expect(photoId('abc')).toBe(photoId('abc'));
    expect(photoId('abc')).not.toBe(photoId('abd'));
  });
});
