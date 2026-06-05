import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

let fetchSpy: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchSpy = vi.fn(
    async () => new Response(JSON.stringify({ ok: true, result: {} }), { status: 200 }),
  );
  vi.stubGlobal('fetch', fetchSpy);
});
afterEach(() => vi.restoreAllMocks());

describe('webhook auth', () => {
  it('rejects a missing/wrong secret token with 401', async () => {
    expect((await post({}, 'nope')).status).toBe(401);
    expect((await post({})).status).toBe(401);
  });

  it('ignores a sender not on the allowlist but returns 200', async () => {
    const res = await post(
      { message: { chat: { id: 999 }, from: { id: 999 }, text: 'hi' } },
      'secret',
    );
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

describe('webhook routing', () => {
  it('returns 200 on malformed JSON and does not call out', async () => {
    const request = new Request('https://x/telegram/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Telegram-Bot-Api-Secret-Token': 'secret' },
      body: 'not json{',
    });
    const res = await onRequestPost({ request, env } as never);
    expect(res.status).toBe(200);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('silently ignores a non-allowlisted message: no outbound call', async () => {
    const res = await post(
      { message: { chat: { id: 999 }, from: { id: 999 }, text: 'hi' } },
      'secret',
    );
    expect(res.status).toBe(200);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('non-allowlisted callback only answers the spinner, nothing more', async () => {
    const res = await post(
      {
        callback_query: {
          id: 'cq1',
          from: { id: 999 },
          message: { chat: { id: 999 } },
          data: 'pick:x',
        },
      },
      'secret',
    );
    expect(res.status).toBe(200);
    // exactly one call: answerCallbackQuery (no status read/commit, no sendMessage)
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(String(fetchSpy.mock.calls[0][0])).toContain('answerCallbackQuery');
  });

  it('allowlisted /start replies (one sendMessage)', async () => {
    const res = await post(
      { message: { chat: { id: 111 }, from: { id: 111 }, text: '/start' } },
      'secret',
    );
    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalled();
    expect(String(fetchSpy.mock.calls[0][0])).toContain('sendMessage');
  });
});
