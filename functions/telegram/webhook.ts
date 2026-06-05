/// <reference types="@cloudflare/workers-types" />
import type { Env } from '../api/_env';
import { loadSession, clearSession } from './_session';
import { handleWizard, startWizard, type WizardInput } from './_wizard';
import { listForStatus, handleStatusCallback, isStatusCallback } from './_status';
import { sendMessage, answerCallback, removeKeyboard } from './_telegram';

// Minimal slice of a Telegram Update we consume.
interface TgUpdate {
  message?: {
    chat: { id: number };
    from?: { id: number };
    text?: string;
    photo?: Array<{ file_id: string }>;
    location?: { latitude: number; longitude: number };
  };
  callback_query?: {
    id: string;
    from: { id: number };
    message?: { chat: { id: number } };
    data?: string;
  };
}

function allowed(env: Env, userId: number | undefined): boolean {
  if (userId === undefined) return false;
  return env.TELEGRAM_ALLOWED_IDS.split(',')
    .map((s) => s.trim())
    .includes(String(userId));
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  // Gate 1: webhook secret token.
  if (request.headers.get('X-Telegram-Bot-Api-Secret-Token') !== env.TELEGRAM_WEBHOOK_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }

  let update: TgUpdate;
  try {
    update = await request.json();
  } catch {
    return new Response('ok', { status: 200 }); // never make Telegram retry
  }

  try {
    await route(env, update);
  } catch (e) {
    console.error('webhook handler error', e);
  }
  return new Response('ok', { status: 200 });
};

async function route(env: Env, update: TgUpdate): Promise<void> {
  // ── callback queries (button taps) ──
  if (update.callback_query) {
    const cq = update.callback_query;
    const chatId = cq.message?.chat.id;
    if (chatId === undefined || !allowed(env, cq.from.id)) {
      await answerCallback(env, cq.id);
      return;
    }
    const data = cq.data ?? '';
    if (isStatusCallback(data)) {
      await handleStatusCallback(env, chatId, cq.id, data);
      return;
    }
    const session = await loadSession(env, chatId);
    if (!session) {
      await answerCallback(env, cq.id);
      await sendMessage(env, chatId, 'That session expired. Send /new to start again.');
      return;
    }
    const input: WizardInput = { kind: 'callback', data, callbackId: cq.id };
    await handleWizard(env, chatId, session, input);
    return;
  }

  // ── messages ──
  const msg = update.message;
  if (!msg) return;
  const chatId = msg.chat.id;
  if (!allowed(env, msg.from?.id)) return; // silently ignore

  // Commands
  const text = msg.text?.trim();
  if (text?.startsWith('/')) {
    const cmd = text.split(/\s+/)[0];
    if (cmd === '/new') return startWizard(env, chatId);
    if (cmd === '/status') return listForStatus(env, chatId);
    if (cmd === '/cancel') {
      await clearSession(env, chatId);
      await sendMessage(env, chatId, 'Cancelled.', removeKeyboard);
      return;
    }
    if (cmd === '/start') {
      await sendMessage(
        env,
        chatId,
        'Listings bot. /new to create a listing, /status to change one, /cancel to abort.',
      );
      return;
    }
    return;
  }

  // Non-command messages only matter inside an active wizard.
  const session = await loadSession(env, chatId);
  if (!session) {
    await sendMessage(env, chatId, 'Send /new to create a listing.');
    return;
  }

  const input = toWizardInput(msg);
  if (!input) return;
  await handleWizard(env, chatId, session, input);
}

function toWizardInput(msg: NonNullable<TgUpdate['message']>): WizardInput | null {
  if (msg.photo?.length) {
    // Largest rendition is last in Telegram's size array.
    return { kind: 'photo', fileId: msg.photo[msg.photo.length - 1].file_id };
  }
  if (msg.location) {
    return { kind: 'location', lat: msg.location.latitude, lng: msg.location.longitude };
  }
  if (typeof msg.text === 'string') return { kind: 'text', text: msg.text };
  return null;
}
