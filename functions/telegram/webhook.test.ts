import { describe, it, expect } from 'vitest';
import { onRequestPost } from './webhook';
import type { Env } from '../api/_env';

const env = {
  TELEGRAM_WEBHOOK_SECRET: 'secret',
  TELEGRAM_ALLOWED_IDS: '111,222',
  TELEGRAM_BOT_TOKEN: 't',
  SESSIONS: { get: async () => null, put: async () => {}, delete: async () => {} },
} as unknown as Env;

function post(body: unknown, secret?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (secret !== undefined) headers['X-Telegram-Bot-Api-Secret-Token'] = secret;
  const request = new Request('https://x/telegram/webhook', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  return onRequestPost({ request, env } as never);
}

describe('webhook auth', () => {
  it('rejects a missing/wrong secret token with 401', async () => {
    expect((await post({}, 'nope')).status).toBe(401);
    expect((await post({})).status).toBe(401);
  });

  it('ignores a sender not on the allowlist but returns 200', async () => {
    const res = await post({ message: { chat: { id: 999 }, from: { id: 999 }, text: 'hi' } }, 'secret');
    expect(res.status).toBe(200);
  });

  it('returns 200 for a well-formed allowed update', async () => {
    const res = await post(
      { message: { chat: { id: 111 }, from: { id: 111 }, text: '/cancel' } },
      'secret',
    );
    expect(res.status).toBe(200);
  });
});
