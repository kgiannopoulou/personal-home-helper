/** The few home-helper-api calls the phone makes. */
import type { SyncRequest, SyncResponse } from './types';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public errors?: Record<string, string[]>,
  ) {
    super(message);
  }
}

export interface HouseholdInfo {
  id: string;
  name: string;
  currency: string;
  role: 'owner' | 'member';
}

export interface MemberInfo {
  id: number;
  name: string;
  email: string;
  role: 'owner' | 'member';
}

const TIMEOUT_MS = 20000;

async function call<T>(url: string, init: { method?: string; token?: string | null; body?: unknown } = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: init.method ?? 'GET',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    if (res.status === 204) return undefined as T;
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(res.status, json.message ?? `The server said ${res.status}`, json.errors);
    return json as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(0, "Can't reach the server. Check the address and your connection.");
  } finally {
    clearTimeout(timer);
  }
}

/** "home.example.com" → "https://home.example.com", no trailing slash */
export function normalizeServerUrl(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, '');
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function api(serverUrl: string, token: string | null) {
  const u = (path: string) => `${serverUrl}/api${path}`;
  return {
    login: (email: string, password: string, deviceName: string) =>
      call<{ token: string; user: { id: number; name: string; email: string } }>(u('/login'), { method: 'POST', body: { email, password, device_name: deviceName } }),
    logout: () => call<void>(u('/logout'), { method: 'POST', token }),
    households: async () => (await call<{ data: HouseholdInfo[] }>(u('/households'), { token })).data,
    createHousehold: async (name: string) => (await call<{ data: HouseholdInfo }>(u('/households'), { method: 'POST', token, body: { name } })).data,
    members: async (householdId: string) => (await call<{ data: MemberInfo[] }>(u(`/households/${householdId}/members`), { token })).data,
    invite: (householdId: string, email: string) => call<unknown>(u(`/households/${householdId}/invites`), { method: 'POST', token, body: { email } }),
    /**
     * The link from the invite email; the signature in it is checked by the server. Only a link to
     * this server's invites is followed, so the token never goes anywhere else.
     */
    acceptInvite: async (link: string) => {
      const url = link.trim();
      if (!url.startsWith(`${serverUrl}/api/invites/`)) throw new ApiError(0, `That isn't an invite link from ${serverUrl}.`);
      return (await call<{ data: HouseholdInfo }>(url, { method: 'POST', token })).data;
    },
    sync: (householdId: string, request: SyncRequest) => call<SyncResponse>(u(`/households/${householdId}/sync`), { method: 'POST', token, body: request }),
  };
}
