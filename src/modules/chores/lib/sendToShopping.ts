import { sendToShopping as send } from '../../kitchen/lib/sendToShopping';

/** Sends supplies that run low to the Shopping module. */
export function sendToShopping(items: string[]): Promise<'app' | 'share'> {
  return send({ items });
}
