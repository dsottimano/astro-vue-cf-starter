/// <reference types="@cloudflare/workers-types" />
import type { Env } from '../api/_env';
import type { ListingFormModel } from '../../src/admin/model';

export type WizardStep =
  | 'locale'
  | 'title'
  | 'propertyType'
  | 'price'
  | 'currency'
  | 'beds'
  | 'baths'
  | 'area'
  | 'areaUnit'
  | 'lotSize'
  | 'street'
  | 'city'
  | 'region'
  | 'country'
  | 'coords'
  | 'features'
  | 'photos'
  | 'description'
  | 'status'
  | 'confirm';

export interface WizardSession {
  step: WizardStep;
  draft: Partial<ListingFormModel>;
  updatedAt: number;
}

const TTL_SECONDS = 60 * 60; // abandoned wizards expire after 1h
const keyFor = (chatId: number) => `wizard:${chatId}`;

export async function loadSession(env: Env, chatId: number): Promise<WizardSession | null> {
  const raw = await env.SESSIONS.get(keyFor(chatId));
  return raw ? (JSON.parse(raw) as WizardSession) : null;
}

export async function saveSession(env: Env, chatId: number, session: WizardSession): Promise<void> {
  await env.SESSIONS.put(keyFor(chatId), JSON.stringify(session), { expirationTtl: TTL_SECONDS });
}

export async function clearSession(env: Env, chatId: number): Promise<void> {
  await env.SESSIONS.delete(keyFor(chatId));
}
