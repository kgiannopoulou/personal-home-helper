import { router } from 'expo-router';
import type { ShoppingImport } from '../../../shared/homeCore';

/**
 * In Home Helper the shopping list is a module of the same app, so this opens its import
 * screen directly (the standalone app used a smartshopping:// link instead).
 */
export async function sendToShopping(data: ShoppingImport): Promise<'app' | 'share'> {
  router.push({
    pathname: '/shopping/add',
    params: {
      items: data.items.join('|'),
      ...(data.spend !== undefined ? { spend: data.spend.toFixed(2) } : {}),
      ...(data.store ? { store: data.store } : {}),
      ...(data.date ? { date: data.date } : {}),
      // Makes every send unique, so sending the same items twice still imports them.
      sent: String(Date.now()),
    },
  });
  return 'app';
}
