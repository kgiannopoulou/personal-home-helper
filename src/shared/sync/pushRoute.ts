/**
 * Where tapping a push from the server opens the app. The server sends `data.url`
 * ("/shopping", "/money", "/"); only paths to screens of this app are followed.
 */
const ROUTES = ['/', '/shopping', '/money', '/chores', '/kitchen', '/food', '/planner', '/activity', '/weather', '/assistant', '/settings'];

export function pushRoute(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const url = (data as { url?: unknown }).url;
  if (typeof url !== 'string') return null;
  const path = url.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  return ROUTES.some((r) => path === r || (r !== '/' && path.startsWith(`${r}/`))) ? path : null;
}
