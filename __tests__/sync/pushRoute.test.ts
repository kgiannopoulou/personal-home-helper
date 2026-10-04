import { describe, expect, test } from '@jest/globals';
import { pushRoute } from '../../src/shared/sync/pushRoute';

describe('pushRoute', () => {
  test('opens the screen a push from the server is about', () => {
    expect(pushRoute({ url: '/shopping' })).toBe('/shopping');
    expect(pushRoute({ url: '/money/' })).toBe('/money');
    expect(pushRoute({ url: '/' })).toBe('/');
    expect(pushRoute({ url: '/chores/abc?x=1' })).toBe('/chores/abc');
  });

  test('ignores anything that is not a screen of this app', () => {
    expect(pushRoute(undefined)).toBeNull();
    expect(pushRoute({})).toBeNull();
    expect(pushRoute({ url: 42 })).toBeNull();
    expect(pushRoute({ url: 'https://example.com/shopping' })).toBeNull();
    expect(pushRoute({ url: '/shoppingevil' })).toBeNull();
    expect(pushRoute({ url: '/unknown' })).toBeNull();
  });
});
