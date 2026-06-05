/// <reference types="@cloudflare/workers-types" />
import type { Env } from '../api/_env';
import { listDir, readFile, commitFile, type DirEntry } from '../api/_github';
import { parseEntry, serializeEntry } from '../../src/admin/frontmatter';
import { sendMessage, answerCallback, inlineKeyboard } from './_telegram';

const STATUSES = ['draft', 'for-sale', 'pending', 'sold'] as const;
const DEFAULT_LOCALE = 'en';

// Pure: swap the status frontmatter field, keep everything else.
export function withStatus(raw: string, status: string): string {
  const { data, body } = parseEntry(raw);
  return serializeEntry({ ...data, status }, body);
}

// /status → list recent listings as buttons.
export async function listForStatus(env: Env, chatId: number): Promise<void> {
  let files: DirEntry[];
  try {
    files = await listDir(env, `src/content/listings/${DEFAULT_LOCALE}`);
  } catch {
    await sendMessage(env, chatId, 'Could not load listings.');
    return;
  }
  if (!files.length) {
    await sendMessage(env, chatId, 'No listings yet.');
    return;
  }
  const rows = files.slice(0, 20).map((f) => [[f.name.replace(/\.md$/, ''), `pick:${f.path}`]] as [string, string][]);
  await sendMessage(env, chatId, 'Which listing?', inlineKeyboard(rows));
}

// Route a status-flow callback (pick:... / set:status:path).
export async function handleStatusCallback(
  env: Env,
  chatId: number,
  callbackId: string,
  data: string,
): Promise<void> {
  await answerCallback(env, callbackId);

  if (data.startsWith('pick:')) {
    const path = data.slice('pick:'.length);
    const rows = STATUSES.map((s) => [[s, `set:${s}:${path}`]] as [string, string][]);
    await sendMessage(env, chatId, 'New status?', inlineKeyboard(rows));
    return;
  }

  if (data.startsWith('set:')) {
    const rest = data.slice('set:'.length);
    const sep = rest.indexOf(':');
    const status = rest.slice(0, sep);
    const path = rest.slice(sep + 1);
    try {
      const file = await readFile(env, path);
      if (!file) {
        await sendMessage(env, chatId, 'That listing no longer exists.');
        return;
      }
      await commitFile(env, path, withStatus(file.content, status), `listing: ${status} ${path}`);
      await sendMessage(env, chatId, `✅ Set to <b>${status}</b>. Publishing…`);
    } catch {
      await sendMessage(env, chatId, '❌ Could not update status. Try again.');
    }
  }
}

export function isStatusCallback(data: string): boolean {
  return data.startsWith('pick:') || data.startsWith('set:');
}
