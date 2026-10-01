/**
 * Minimal Home Assistant REST client (https://developers.home-assistant.io/docs/api/rest/).
 * Needs the HA URL and a long-lived access token (HA → your profile → Security).
 */

export class HomeAssistantError extends Error {}

const base = (url: string) => url.trim().replace(/\/+$/, '');

async function request(url: string, token: string, path: string, init?: RequestInit): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(`${base(url)}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
  } catch {
    throw new HomeAssistantError('Could not reach Home Assistant. Check the URL and that your phone is on the same network.');
  }
  if (res.status === 401) throw new HomeAssistantError('Home Assistant rejected the token. Create a new long-lived token.');
  if (res.status === 404) throw new HomeAssistantError('Entity not found in Home Assistant. Check the entity ID.');
  if (!res.ok) throw new HomeAssistantError(`Home Assistant error (${res.status}).`);
  return res.json();
}

/** Parses a sensor state like "41.5"; unavailable/unknown → undefined. */
export function parseSensorState(state: unknown): number | undefined {
  const v = Number(state);
  return typeof state === 'string' && state.trim() !== '' && Number.isFinite(v) ? v : undefined;
}

export async function readSensor(url: string, token: string, entityId: string): Promise<number | undefined> {
  const json = (await request(url, token, `/api/states/${encodeURIComponent(entityId.trim())}`)) as { state?: unknown };
  return parseSensorState(json.state);
}

/** Turns on a humidifier.* / switch.* / fan.* entity. */
export async function turnOn(url: string, token: string, entityId: string): Promise<void> {
  const id = entityId.trim();
  const domain = id.split('.')[0];
  if (!['humidifier', 'switch', 'fan', 'input_boolean'].includes(domain)) {
    throw new HomeAssistantError('Use a humidifier.*, switch.* or fan.* entity for the humidifier.');
  }
  await request(url, token, `/api/services/${domain}/turn_on`, { method: 'POST', body: JSON.stringify({ entity_id: id }) });
}
