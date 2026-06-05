/// <reference types="@cloudflare/workers-types" />
import type { Env } from '../api/_env';

// Thin Telegram Bot API client (raw fetch — no third-party library).

const api = (env: Env, method: string) =>
  `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`;

export interface InlineKeyboard {
  inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
}
export interface LocationKeyboard {
  keyboard: Array<Array<{ text: string; request_location: true }>>;
  resize_keyboard: true;
  one_time_keyboard: true;
}
export interface RemoveKeyboard {
  remove_keyboard: true;
}
type ReplyMarkup = InlineKeyboard | LocationKeyboard | RemoveKeyboard;

async function call(env: Env, method: string, payload: unknown): Promise<void> {
  // Bot replies are fire-and-forget from the webhook's perspective; failures are
  // logged but never thrown (the webhook must still return 200 to Telegram).
  try {
    const res = await fetch(api(env, method), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) console.error(`telegram ${method} failed: ${res.status}`);
  } catch (e) {
    console.error(`telegram ${method} error`, e);
  }
}

export function sendMessage(
  env: Env,
  chatId: number,
  text: string,
  replyMarkup?: ReplyMarkup,
): Promise<void> {
  return call(env, 'sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    reply_markup: replyMarkup,
  });
}

export function answerCallback(env: Env, callbackQueryId: string, text?: string): Promise<void> {
  return call(env, 'answerCallbackQuery', { callback_query_id: callbackQueryId, text });
}

// Download a Telegram file by file_id → its raw bytes.
export async function downloadFile(env: Env, fileId: string): Promise<ArrayBuffer> {
  const metaRes = await fetch(api(env, 'getFile'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_id: fileId }),
  });
  const meta = (await metaRes.json()) as { ok: boolean; result?: { file_path: string } };
  if (!meta.ok || !meta.result) throw new Error('getFile failed');
  const fileRes = await fetch(
    `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${meta.result.file_path}`,
  );
  if (!fileRes.ok) throw new Error(`file download failed (${fileRes.status})`);
  return fileRes.arrayBuffer();
}

// ── keyboard builders (pure) ─────────────────────────────────────────────────
export function inlineKeyboard(rows: Array<Array<[string, string]>>): InlineKeyboard {
  return {
    inline_keyboard: rows.map((row) => row.map(([text, data]) => ({ text, callback_data: data }))),
  };
}

export function locationKeyboard(label = '📍 Share location'): LocationKeyboard {
  return {
    keyboard: [[{ text: label, request_location: true }]],
    resize_keyboard: true,
    one_time_keyboard: true,
  };
}

export const removeKeyboard: RemoveKeyboard = { remove_keyboard: true };
