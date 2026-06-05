# Telegram Listings Bot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let allow-listed users create real-estate listings (with media) and flip a listing's status by chatting with a Telegram bot, which commits content to GitHub and uploads media to R2 — reusing the starter's existing content seam.

**Architecture:** A new Cloudflare Pages Function at `/telegram/webhook` receives Telegram updates. It authenticates (secret-token header + sender allowlist), keeps a per-chat wizard session in Workers KV, and on confirm builds a listing `.md` (via the admin's existing `buildListingFile`) and commits it through the GitHub Contents API. It lives outside `functions/api/`, so the Cloudflare Access middleware never applies. Shared GitHub/R2 logic is extracted from the existing API functions so both the HTTP API and the bot use one code path.

**Tech Stack:** TypeScript on Cloudflare Pages Functions (workerd), Telegram Bot API (raw `fetch`, no library), Workers KV, R2, GitHub Contents API, js-yaml (already a dep), vitest.

**Spec:** `docs/superpowers/specs/2026-06-04-telegram-listings-bot-design.md`

---

## Reuse map (read before starting)

These existing modules are framework-free and imported directly by the bot — do **not** reimplement them:

- `src/admin/model.ts` — `ListingFormModel`, `emptyListing(locale)`, `slugify(title)`, types `Status` / `PropertyType` / `AreaUnit`.
- `src/admin/serialize.ts` — `buildListingFile(model): { path, content }`, `parseListingFile(raw, fallbackLocale)`.
- `src/admin/frontmatter.ts` — `serializeEntry` / `parseEntry` (pure js-yaml).
- `functions/api/_github.ts` — `contentsUrl`, `ghHeaders`, `getSha`, `toBase64`, `fromBase64`, `isUnsafePath`.

> **Bundling note:** Pages Functions are bundled by wrangler/esbuild following imports, so `functions/telegram/*` importing `../../src/admin/*` works (the chain is pure TS + js-yaml, no Vue/Astro). If a `wrangler pages dev` build ever fails to resolve these, the fallback is to copy those three pure modules into `functions/_shared/` — but try the direct import first.

## File structure

**Phase 1 — shared extraction (no new behavior):**
- Modify `functions/api/_github.ts` — add `commitFile`, `readFile`, `listDir`.
- Modify `functions/api/commit.ts`, `functions/api/entry.ts`, `functions/api/list.ts` — call the new helpers.
- Create `functions/api/_media.ts` — `ALLOWED`, `MAX_BYTES`, `buildKey`, `putMedia`.
- Modify `functions/api/upload.ts` — call `_media.ts`.

**Phase 2 — bindings:**
- Modify `functions/api/_env.ts` — Telegram + KV bindings.
- Modify `wrangler.toml`, `.dev.vars.example`.

**Phase 3 — bot building blocks:**
- Create `functions/telegram/_telegram.ts` — Bot API client + keyboard builders.
- Create `functions/telegram/_session.ts` — KV session load/save/clear + `WizardSession` type.
- Create `functions/telegram/_listing.ts` — slug resolution + draft finalization.

**Phase 4 — flows:**
- Create `functions/telegram/_wizard.ts` — create state machine.
- Create `functions/telegram/_status.ts` — mark-status flow.
- Create `functions/telegram/webhook.ts` — auth + routing entry point.

**Phase 5 — setup & docs:**
- Create `cli/telegram-setup.mjs` — register webhook + command menu.
- Modify `README.md` (or create `docs/telegram-bot.md`) — operator setup steps.

**Tests:** `functions/api/_github.test.ts` (new helpers), `functions/telegram/_listing.test.ts`, `functions/telegram/_wizard.test.ts`, `functions/telegram/_telegram.test.ts`, `functions/telegram/webhook.test.ts`.

> **Test command convention:** run vitest via the local binary to avoid the rtk wrapper mangling output: `./node_modules/.bin/vitest run <path>`.

---

## Task 0: Provision Cloudflare resources (operator step)

**This task is manual setup, done once by the operator. No code.** Record the IDs for Task 3.

- [ ] **Step 1: Create the Telegram bot**

Message [@BotFather](https://t.me/BotFather) → `/newbot` → note the **bot token**.

- [ ] **Step 2: Find your numeric Telegram user ID**

Message [@userinfobot](https://t.me/userinfobot); note the numeric `id` for each allowed user.

- [ ] **Step 3: Create the KV namespace**

Run: `./node_modules/.bin/wrangler kv namespace create SESSIONS`
Expected: prints an `id`. Copy it for `wrangler.toml`.

- [ ] **Step 4: Invent a webhook secret**

Run: `node -e "console.log(crypto.randomUUID())"`
Save the value as the webhook secret (used in Task 3 and Task 10).

---

## Task 1: Extract GitHub helpers into `_github.ts`

**Files:**
- Modify: `functions/api/_github.ts`
- Modify: `functions/api/commit.ts`, `functions/api/entry.ts`, `functions/api/list.ts`
- Test: `functions/api/_github.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `functions/api/_github.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { commitFile, readFile, listDir } from './_github';
import type { Env } from './_env';

const env = { GITHUB_REPO: 'o/r', GITHUB_BRANCH: 'main', GITHUB_TOKEN: 't' } as Env;

afterEach(() => vi.restoreAllMocks());

function mockFetch(...responses: Response[]) {
  const fn = vi.fn();
  responses.forEach((r) => fn.mockResolvedValueOnce(r));
  vi.stubGlobal('fetch', fn);
  return fn;
}

describe('_github helpers', () => {
  it('readFile returns null on 404', async () => {
    mockFetch(new Response('', { status: 404 }));
    expect(await readFile(env, 'src/content/listings/en/x.md')).toBeNull();
  });

  it('readFile decodes base64 content', async () => {
    const body = JSON.stringify({ content: btoa('hello'), sha: 'abc' });
    mockFetch(new Response(body, { status: 200 }));
    const r = await readFile(env, 'p.md');
    expect(r).toEqual({ content: 'hello', sha: 'abc' });
  });

  it('listDir returns [] on 404 and maps files only', async () => {
    mockFetch(new Response('', { status: 404 }));
    expect(await listDir(env, 'src/content/listings/en')).toEqual([]);

    const dir = JSON.stringify([
      { name: 'a.md', path: 'd/a.md', sha: '1', type: 'file' },
      { name: 'sub', path: 'd/sub', sha: '2', type: 'dir' },
    ]);
    mockFetch(new Response(dir, { status: 200 }));
    expect(await listDir(env, 'd')).toEqual([{ name: 'a.md', path: 'd/a.md', sha: '1' }]);
  });

  it('commitFile PUTs and returns the new commit sha', async () => {
    const fn = mockFetch(
      new Response('', { status: 404 }), // getSha → not found
      new Response(JSON.stringify({ commit: { sha: 'deadbeef' } }), { status: 200 }),
    );
    const sha = await commitFile(env, 'p.md', 'body', 'msg');
    expect(sha).toBe('deadbeef');
    const putCall = fn.mock.calls[1];
    expect(putCall[1].method).toBe('PUT');
  });

  it('commitFile throws on non-ok PUT', async () => {
    mockFetch(new Response('', { status: 404 }), new Response('', { status: 500 }));
    await expect(commitFile(env, 'p.md', 'b', 'm')).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/vitest run functions/api/_github.test.ts`
Expected: FAIL — `commitFile`, `readFile`, `listDir` are not exported.

- [ ] **Step 3: Add the helpers to `_github.ts`**

Append to `functions/api/_github.ts` (after `getSha`):

```ts
// Commit (create or update) a text file; returns the new commit sha.
export async function commitFile(
  env: Env,
  path: string,
  content: string,
  message: string,
): Promise<string> {
  const sha = await getSha(env, path);
  const put = await fetch(contentsUrl(env, path), {
    method: 'PUT',
    headers: ghHeaders(env.GITHUB_TOKEN),
    body: JSON.stringify({ message, content: toBase64(content), branch: env.GITHUB_BRANCH, sha }),
  });
  if (!put.ok) throw new Error(`github commit failed (${put.status})`);
  const result = (await put.json()) as { commit: { sha: string } };
  return result.commit.sha;
}

// Read a file's decoded content + sha, or null if it doesn't exist.
export async function readFile(
  env: Env,
  path: string,
): Promise<{ content: string; sha: string } | null> {
  const res = await fetch(`${contentsUrl(env, path)}?ref=${env.GITHUB_BRANCH}`, {
    headers: ghHeaders(env.GITHUB_TOKEN),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`github read failed (${res.status})`);
  const data = (await res.json()) as { content: string; sha: string };
  return { content: fromBase64(data.content), sha: data.sha };
}

export interface DirEntry {
  name: string;
  path: string;
  sha: string;
}

// List files (not subdirectories) in a content directory; [] if missing.
export async function listDir(env: Env, dir: string): Promise<DirEntry[]> {
  const res = await fetch(`${contentsUrl(env, dir)}?ref=${env.GITHUB_BRANCH}`, {
    headers: ghHeaders(env.GITHUB_TOKEN),
  });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`github list failed (${res.status})`);
  const data = (await res.json()) as
    | Array<{ name: string; path: string; sha: string; type: string }>
    | { name: string; path: string; sha: string; type: string };
  const arr = Array.isArray(data) ? data : [data];
  return arr.filter((e) => e.type === 'file').map((e) => ({ name: e.name, path: e.path, sha: e.sha }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./node_modules/.bin/vitest run functions/api/_github.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Refactor the three consumers to use the helpers**

In `functions/api/commit.ts`, replace the `getSha` + PUT block (the body from `let sha:` through the `Response.json({ ok: true, commit })`) with:

```ts
  try {
    const commit = await commitFile(env, path, content, message ?? `content: update ${path}`);
    return Response.json({ ok: true, commit });
  } catch {
    return Response.json({ error: 'github commit failed' }, { status: 502 });
  }
```

Update its import line to: `import { isUnsafePath, commitFile } from './_github';`

In `functions/api/entry.ts`, replace the body of `onRequestGet` (after the `path` guard) with:

```ts
  let file: { content: string; sha: string } | null;
  try {
    file = await readFile(env, path);
  } catch {
    return Response.json({ error: 'github read failed' }, { status: 502 });
  }
  if (!file) return Response.json({ error: 'not found' }, { status: 404 });
  return Response.json({ content: file.content, sha: file.sha });
```

Update its import to include `readFile` and drop now-unused `contentsUrl`, `ghHeaders`, `fromBase64` if no longer referenced (keep `getSha`, `isUnsafePath` — `onRequestDelete` still uses them):
`import { contentsUrl, ghHeaders, getSha, isUnsafePath, readFile } from './_github';`
(`onRequestDelete` keeps using `contentsUrl`/`ghHeaders`/`getSha`, so leave those imported.)

In `functions/api/list.ts`, replace the fetch+map block with:

```ts
  let entries;
  try {
    entries = await listDir(env, dir);
  } catch {
    return Response.json({ error: 'github list failed' }, { status: 502 });
  }
  return Response.json({ entries });
```

Update its import to: `import { isUnsafePath, listDir } from './_github';` and delete the now-unused `GhEntry` interface.

- [ ] **Step 6: Run the full suite + type check**

Run: `./node_modules/.bin/vitest run functions/api`
Expected: PASS (commit/entry/list/_github tests all green).
Run: `npm run check`
Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add functions/api/_github.ts functions/api/commit.ts functions/api/entry.ts functions/api/list.ts functions/api/_github.test.ts
git commit -m "refactor: extract commitFile/readFile/listDir into _github"
```

---

## Task 2: Extract media helpers into `_media.ts`

**Files:**
- Create: `functions/api/_media.ts`
- Modify: `functions/api/upload.ts`
- Test: `functions/api/_media.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `functions/api/_media.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildKey, ALLOWED, MAX_BYTES } from './_media';

describe('_media helpers', () => {
  it('buildKey sanitizes filename and applies prefix', () => {
    const key = buildKey('listings/photos', 'My Photo!.JPG');
    expect(key).toMatch(/^listings\/photos\/[a-z0-9]{8}-my-photo-.jpg$/);
  });

  it('buildKey falls back to uploads for an empty prefix', () => {
    expect(buildKey('', 'a.png')).toMatch(/^uploads\//);
  });

  it('exposes allowed types and size cap', () => {
    expect(ALLOWED.has('image/jpeg')).toBe(true);
    expect(ALLOWED.has('text/plain')).toBe(false);
    expect(MAX_BYTES).toBe(15 * 1024 * 1024);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/vitest run functions/api/_media.test.ts`
Expected: FAIL — module `./_media` not found.

- [ ] **Step 3: Create `_media.ts`**

```ts
/// <reference types="@cloudflare/workers-types" />
import type { Env } from './_env';

// Shared R2 media helpers used by /api/upload and the Telegram bot.

export const ALLOWED = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'application/pdf',
]);
export const MAX_BYTES = 15 * 1024 * 1024; // 15 MB

// "photos/<rand>-<name>.jpg" — collision-resistant.
export function buildKey(prefix: string, filename: string): string {
  const safe = filename
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const rand = crypto.randomUUID().slice(0, 8);
  const clean = prefix.replace(/[^a-z0-9/_-]/gi, '').replace(/^\/+|\/+$/g, '') || 'uploads';
  return `${clean}/${rand}-${safe}`;
}

// Put a binary to R2 under an already-built key.
export async function putMedia(
  env: Env,
  body: ReadableStream | ArrayBuffer | Uint8Array,
  contentType: string,
  key: string,
): Promise<void> {
  await env.MEDIA.put(key, body, { httpMetadata: { contentType } });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./node_modules/.bin/vitest run functions/api/_media.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Refactor `upload.ts` to use `_media.ts`**

Replace the top of `functions/api/upload.ts` (the `ALLOWED`/`MAX_BYTES`/`buildKey` definitions) with an import, and use `putMedia` for the write. The full file becomes:

```ts
/// <reference types="@cloudflare/workers-types" />
import type { Env } from './_env';
import { ALLOWED, MAX_BYTES, buildKey, putMedia } from './_media';

// POST multipart/form-data { file, prefix? }
// Puts a binary to R2 and returns its key.

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: 'expected multipart/form-data' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return Response.json({ error: 'file is required' }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return Response.json({ error: `unsupported type: ${file.type}` }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: 'file too large' }, { status: 413 });
  }

  const prefix = (form.get('prefix') as string | null) ?? 'photos';
  const key = buildKey(prefix, file.name);
  await putMedia(env, file.stream(), file.type, key);

  return Response.json({ ok: true, key });
};
```

- [ ] **Step 6: Run the suite + type check**

Run: `./node_modules/.bin/vitest run functions/api`
Expected: PASS (upload validation tests still green).
Run: `npm run check`
Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add functions/api/_media.ts functions/api/upload.ts functions/api/_media.test.ts
git commit -m "refactor: extract R2 media helpers into _media"
```

---

## Task 3: Add Telegram + KV bindings

**Files:**
- Modify: `functions/api/_env.ts`
- Modify: `wrangler.toml`
- Modify: `.dev.vars.example`

- [ ] **Step 1: Extend the `Env` interface**

In `functions/api/_env.ts`, add inside the `Env` interface (after the `MEDIA` field):

```ts
  // Telegram bot
  TELEGRAM_BOT_TOKEN: string; // secret — from BotFather
  TELEGRAM_WEBHOOK_SECRET: string; // secret — setWebhook secret_token
  TELEGRAM_ALLOWED_IDS: string; // comma-separated numeric Telegram user IDs
  SESSIONS: KVNamespace; // wizard session state
```

- [ ] **Step 2: Add the KV binding + vars to `wrangler.toml`**

Append to `wrangler.toml`:

```toml
# KV namespace for Telegram wizard session state.
# Create with: wrangler kv namespace create SESSIONS
[[kv_namespaces]]
binding = "SESSIONS"
id = "REPLACE_WITH_KV_NAMESPACE_ID"
```

And add to the existing `[vars]` block:

```toml
# Comma-separated numeric Telegram user IDs allowed to drive the bot.
TELEGRAM_ALLOWED_IDS = "123456789"
```

(`TELEGRAM_BOT_TOKEN` and `TELEGRAM_WEBHOOK_SECRET` are secrets, NOT in wrangler.toml. Set them with:
`wrangler pages secret put TELEGRAM_BOT_TOKEN` and `wrangler pages secret put TELEGRAM_WEBHOOK_SECRET`.)

- [ ] **Step 3: Document them in `.dev.vars.example`**

Append to `.dev.vars.example`:

```
# Telegram bot (local dev). For local testing the webhook needs a public
# tunnel (cloudflared/ngrok) pointed at `wrangler pages dev`.
TELEGRAM_BOT_TOKEN=123456:your-botfather-token
TELEGRAM_WEBHOOK_SECRET=your-random-webhook-secret
TELEGRAM_ALLOWED_IDS=123456789
```

- [ ] **Step 4: Type check**

Run: `npm run check`
Expected: 0 errors. (`KVNamespace` is provided by `@cloudflare/workers-types`, already referenced via the triple-slash directive at the top of `_env.ts`'s consumers; `_env.ts` has no directive of its own but is only ever imported by files that do — verify `npm run check` stays clean. If `KVNamespace` is unresolved, add `/// <reference types="@cloudflare/workers-types" />` as the first line of `_env.ts`.)

- [ ] **Step 5: Commit**

```bash
git add functions/api/_env.ts wrangler.toml .dev.vars.example
git commit -m "feat: add Telegram + KV bindings to env"
```

---

## Task 4: Telegram Bot API client (`_telegram.ts`)

**Files:**
- Create: `functions/telegram/_telegram.ts`
- Test: `functions/telegram/_telegram.test.ts`

- [ ] **Step 1: Write the failing test**

Create `functions/telegram/_telegram.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { inlineKeyboard, locationKeyboard } from './_telegram';

describe('keyboard builders', () => {
  it('inlineKeyboard maps [label, data] tuples into Telegram buttons', () => {
    const kb = inlineKeyboard([
      [
        ['House', 'pt:house'],
        ['Condo', 'pt:condo'],
      ],
    ]);
    expect(kb).toEqual({
      inline_keyboard: [
        [
          { text: 'House', callback_data: 'pt:house' },
          { text: 'Condo', callback_data: 'pt:condo' },
        ],
      ],
    });
  });

  it('locationKeyboard requests location and is one-time', () => {
    const kb = locationKeyboard();
    expect(kb.keyboard[0][0].request_location).toBe(true);
    expect(kb.one_time_keyboard).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/vitest run functions/telegram/_telegram.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `_telegram.ts`**

```ts
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
    inline_keyboard: rows.map((row) =>
      row.map(([text, data]) => ({ text, callback_data: data })),
    ),
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./node_modules/.bin/vitest run functions/telegram/_telegram.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add functions/telegram/_telegram.ts functions/telegram/_telegram.test.ts
git commit -m "feat: Telegram Bot API client + keyboard builders"
```

---

## Task 5: KV session store (`_session.ts`)

**Files:**
- Create: `functions/telegram/_session.ts`
- Test: `functions/telegram/_session.test.ts`

- [ ] **Step 1: Write the failing test**

Create `functions/telegram/_session.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { loadSession, saveSession, clearSession, type WizardSession } from './_session';
import type { Env } from '../api/_env';

// Minimal in-memory KV stand-in.
function fakeKv() {
  const store = new Map<string, string>();
  return {
    get: (k: string) => Promise.resolve(store.get(k) ?? null),
    put: (k: string, v: string) => {
      store.set(k, v);
      return Promise.resolve();
    },
    delete: (k: string) => {
      store.delete(k);
      return Promise.resolve();
    },
  };
}

const envWith = (kv: ReturnType<typeof fakeKv>) => ({ SESSIONS: kv }) as unknown as Env;

describe('session store', () => {
  it('returns null when no session exists', async () => {
    expect(await loadSession(envWith(fakeKv()), 1)).toBeNull();
  });

  it('round-trips a session', async () => {
    const kv = fakeKv();
    const env = envWith(kv);
    const s: WizardSession = { step: 'title', draft: { locale: 'en' }, updatedAt: 0 };
    await saveSession(env, 42, s);
    expect(await loadSession(env, 42)).toEqual(s);
  });

  it('clears a session', async () => {
    const kv = fakeKv();
    const env = envWith(kv);
    await saveSession(env, 7, { step: 'title', draft: {}, updatedAt: 0 });
    await clearSession(env, 7);
    expect(await loadSession(env, 7)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/vitest run functions/telegram/_session.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `_session.ts`**

```ts
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
```

> Note: the test's `fakeKv.put` ignores the options arg, which is fine — `expirationTtl` is only meaningful in real KV.

- [ ] **Step 4: Run test to verify it passes**

Run: `./node_modules/.bin/vitest run functions/telegram/_session.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add functions/telegram/_session.ts functions/telegram/_session.test.ts
git commit -m "feat: KV wizard session store"
```

---

## Task 6: Listing finalization (`_listing.ts`)

**Files:**
- Create: `functions/telegram/_listing.ts`
- Test: `functions/telegram/_listing.test.ts`

- [ ] **Step 1: Write the failing test**

Create `functions/telegram/_listing.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { resolveSlug, finalizeListing, buildListingEntry } from './_listing';

describe('resolveSlug', () => {
  it('returns the base slug when free', async () => {
    const exists = vi.fn().mockResolvedValue(false);
    expect(await resolveSlug(exists, 'en', 'Sunny Villa!')).toBe('sunny-villa');
  });

  it('appends a counter on collision', async () => {
    const exists = vi
      .fn()
      .mockResolvedValueOnce(true) // sunny-villa taken
      .mockResolvedValueOnce(false); // sunny-villa-2 free
    expect(await resolveSlug(exists, 'en', 'Sunny Villa')).toBe('sunny-villa-2');
  });

  it('falls back to "listing" for an empty title', async () => {
    const exists = vi.fn().mockResolvedValue(false);
    expect(await resolveSlug(exists, 'en', '!!!')).toBe('listing');
  });
});

describe('finalizeListing', () => {
  it('fills defaults and derives translationKey from slug', () => {
    const m = finalizeListing({ locale: 'en', title: 'X', slug: 'x', price: 100 });
    expect(m.translationKey).toBe('x');
    expect(m.currency).toBe('USD');
    expect(m.status).toBe('draft');
    expect(m.coords).toEqual({ lat: 0, lng: 0 });
    expect(m.photos).toEqual([]);
  });
});

describe('buildListingEntry', () => {
  it('produces the locale-scoped path and YAML frontmatter', () => {
    const entry = buildListingEntry({
      locale: 'en',
      title: 'X',
      slug: 'x',
      price: 100,
      propertyType: 'house',
    });
    expect(entry.path).toBe('src/content/listings/en/x.md');
    expect(entry.content).toContain('title: X');
    expect(entry.content).toContain('propertyType: house');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/vitest run functions/telegram/_listing.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `_listing.ts`**

```ts
/// <reference types="@cloudflare/workers-types" />
import type { Env } from '../api/_env';
import { readFile } from '../api/_github';
import { emptyListing, slugify, type ListingFormModel } from '../../src/admin/model';
import { buildListingFile, type EntryFile } from '../../src/admin/serialize';

// Find a collision-free slug for (locale, title). `exists` is injected so the
// core loop is unit-testable without network; production passes a GitHub probe.
export async function resolveSlug(
  exists: (path: string) => Promise<boolean>,
  locale: string,
  title: string,
): Promise<string> {
  const base = slugify(title) || 'listing';
  let candidate = base;
  for (let n = 2; n <= 50; n++) {
    if (!(await exists(`src/content/listings/${locale}/${candidate}.md`))) return candidate;
    candidate = `${base}-${n}`;
  }
  return `${base}-${crypto.randomUUID().slice(0, 6)}`;
}

// Production probe backed by the GitHub Contents API.
export function ghExists(env: Env): (path: string) => Promise<boolean> {
  return async (path) => (await readFile(env, path)) !== null;
}

// Merge a partial wizard draft onto a complete, schema-valid model.
export function finalizeListing(draft: Partial<ListingFormModel>): ListingFormModel {
  const model = { ...emptyListing(draft.locale ?? 'en'), ...draft };
  model.translationKey = model.translationKey || model.slug;
  return model;
}

export function buildListingEntry(draft: Partial<ListingFormModel>): EntryFile {
  return buildListingFile(finalizeListing(draft));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./node_modules/.bin/vitest run functions/telegram/_listing.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add functions/telegram/_listing.ts functions/telegram/_listing.test.ts
git commit -m "feat: listing slug resolution + draft finalization"
```

---

## Task 7: Create-listing wizard (`_wizard.ts`)

**Files:**
- Create: `functions/telegram/_wizard.ts`
- Test: `functions/telegram/_wizard.test.ts`

This module owns the create flow. The webhook normalizes a Telegram update into an `Input`, then calls `handleWizard`. Pure helpers (`STEP_ORDER`, `stepApplies`, `nextStep`, `parsePositiveNumber`) are unit-tested; `handleWizard` orchestrates side effects (Bot API + R2) through injected `_telegram`/`_listing` calls.

- [ ] **Step 1: Write the failing test (pure helpers)**

Create `functions/telegram/_wizard.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { nextStep, stepApplies, parsePositiveNumber } from './_wizard';

describe('parsePositiveNumber', () => {
  it('parses plain and comma-formatted numbers', () => {
    expect(parsePositiveNumber('875000')).toBe(875000);
    expect(parsePositiveNumber('875,000')).toBe(875000);
    expect(parsePositiveNumber('$875000')).toBe(875000);
  });
  it('rejects non-numbers and negatives', () => {
    expect(parsePositiveNumber('abc')).toBeNull();
    expect(parsePositiveNumber('-5')).toBeNull();
  });
});

describe('stepApplies', () => {
  it('beds/baths/area apply only to house/condo', () => {
    expect(stepApplies('beds', { propertyType: 'house' })).toBe(true);
    expect(stepApplies('beds', { propertyType: 'lot' })).toBe(false);
  });
  it('lotSize applies only to lot/commercial', () => {
    expect(stepApplies('lotSize', { propertyType: 'lot' })).toBe(true);
    expect(stepApplies('lotSize', { propertyType: 'condo' })).toBe(false);
  });
});

describe('nextStep', () => {
  it('skips beds for a lot and lands on lotSize after currency', () => {
    expect(nextStep('currency', { propertyType: 'lot' })).toBe('lotSize');
  });
  it('skips lotSize for a house and lands on beds after currency', () => {
    expect(nextStep('currency', { propertyType: 'house' })).toBe('beds');
  });
  it('confirm is terminal', () => {
    expect(nextStep('confirm', {})).toBe('confirm');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/vitest run functions/telegram/_wizard.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `_wizard.ts`**

```ts
/// <reference types="@cloudflare/workers-types" />
import type { Env } from '../api/_env';
import type { ListingFormModel, PropertyType, Status, AreaUnit } from '../../src/admin/model';
import { type WizardSession, type WizardStep, saveSession, clearSession } from './_session';
import {
  sendMessage,
  answerCallback,
  downloadFile,
  inlineKeyboard,
  locationKeyboard,
  removeKeyboard,
} from './_telegram';
import { buildKey, putMedia } from '../api/_media';
import { commitFile } from '../api/_github';
import { resolveSlug, ghExists, buildListingEntry, finalizeListing } from './_listing';

// Normalized input the webhook hands to the wizard.
export type WizardInput =
  | { kind: 'text'; text: string }
  | { kind: 'callback'; data: string; callbackId: string }
  | { kind: 'location'; lat: number; lng: number }
  | { kind: 'photo'; fileId: string };

export const STEP_ORDER: WizardStep[] = [
  'locale',
  'title',
  'propertyType',
  'price',
  'currency',
  'beds',
  'baths',
  'area',
  'areaUnit',
  'lotSize',
  'street',
  'city',
  'region',
  'country',
  'coords',
  'features',
  'photos',
  'description',
  'status',
  'confirm',
];

export function parsePositiveNumber(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, '');
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function stepApplies(step: WizardStep, draft: Partial<ListingFormModel>): boolean {
  const pt = draft.propertyType;
  if (step === 'beds' || step === 'baths' || step === 'area' || step === 'areaUnit') {
    return pt === 'house' || pt === 'condo';
  }
  if (step === 'lotSize') return pt === 'lot' || pt === 'commercial';
  return true;
}

export function nextStep(current: WizardStep, draft: Partial<ListingFormModel>): WizardStep {
  const i = STEP_ORDER.indexOf(current);
  for (let j = i + 1; j < STEP_ORDER.length; j++) {
    if (stepApplies(STEP_ORDER[j], draft)) return STEP_ORDER[j];
  }
  return 'confirm';
}

// What to send when entering a step.
function prompt(step: WizardStep): { text: string; markup?: ReturnType<typeof inlineKeyboard> | ReturnType<typeof locationKeyboard> } {
  switch (step) {
    case 'locale':
      return { text: '🌐 Language for this listing?', markup: inlineKeyboard([[['English', 'loc:en'], ['Español', 'loc:es']]]) };
    case 'title':
      return { text: '🏷️ Listing title?' };
    case 'propertyType':
      return {
        text: '🏠 Property type?',
        markup: inlineKeyboard([
          [['House', 'pt:house'], ['Condo', 'pt:condo']],
          [['Lot', 'pt:lot'], ['Commercial', 'pt:commercial']],
        ]),
      };
    case 'price':
      return { text: '💲 Price? (numbers only, e.g. 875000)' };
    case 'currency':
      return { text: 'Currency?', markup: inlineKeyboard([[['USD', 'cur:USD'], ['MXN', 'cur:MXN'], ['EUR', 'cur:EUR']]]) };
    case 'beds':
      return { text: '🛏️ Bedrooms?', markup: numberPad('beds') };
    case 'baths':
      return { text: '🛁 Bathrooms?', markup: numberPad('baths') };
    case 'area':
      return { text: '📐 Living area? (number, or Skip)', markup: inlineKeyboard([[['Skip', 'skip']]]) };
    case 'areaUnit':
      return { text: 'Area unit?', markup: inlineKeyboard([[['sqft', 'au:sqft'], ['sqm', 'au:sqm']]]) };
    case 'lotSize':
      return { text: '🗺️ Lot size? (number, or Skip)', markup: inlineKeyboard([[['Skip', 'skip']]]) };
    case 'street':
      return { text: '📫 Street address?' };
    case 'city':
      return { text: 'City?' };
    case 'region':
      return { text: 'Region / state?' };
    case 'country':
      return { text: 'Country? (2-letter code, e.g. US)' };
    case 'coords':
      return { text: '📍 Share the property location, or Skip.', markup: locationKeyboard() };
    case 'features':
      return { text: '✨ Features? (comma-separated, or Skip)', markup: inlineKeyboard([[['Skip', 'skip']]]) };
    case 'photos':
      return { text: '📷 Send photos now. Tap Done when finished.', markup: inlineKeyboard([[['Done', 'done']]]) };
    case 'description':
      return { text: '📝 Description? (or Skip)', markup: inlineKeyboard([[['Skip', 'skip']]]) };
    case 'status':
      return {
        text: 'Status?',
        markup: inlineKeyboard([
          [['Draft', 'st:draft'], ['For sale', 'st:for-sale']],
          [['Pending', 'st:pending'], ['Sold', 'st:sold']],
        ]),
      };
    case 'confirm':
      return { text: '', markup: inlineKeyboard([[['✅ Confirm', 'confirm'], ['✖️ Cancel', 'cancel']]]) };
  }
}

function numberPad(field: 'beds' | 'baths') {
  return inlineKeyboard([
    [['0', `${field}:0`], ['1', `${field}:1`], ['2', `${field}:2`], ['3', `${field}:3`]],
    [['4', `${field}:4`], ['5', `${field}:5`], ['6', `${field}:6`], ['Skip', 'skip']],
  ]);
}

function previewText(draft: Partial<ListingFormModel>): string {
  const m = finalizeListing(draft);
  const lines = [
    `<b>${m.title}</b>`,
    `${m.propertyType} · ${m.status}`,
    `${m.price} ${m.currency}`,
    [m.beds && `${m.beds} bd`, m.baths && `${m.baths} ba`, m.area && `${m.area} ${m.areaUnit}`, m.lotSize && `lot ${m.lotSize}`]
      .filter(Boolean)
      .join(' · '),
    `${m.address.street}, ${m.address.city}, ${m.address.region}, ${m.address.country}`,
    `coords: ${m.coords.lat}, ${m.coords.lng}`,
    m.features.length ? `features: ${m.features.join(', ')}` : '',
    `photos: ${m.photos.length}`,
    '',
    'Create this listing?',
  ];
  return lines.filter((l) => l !== '').join('\n');
}

async function enter(env: Env, chatId: number, session: WizardSession): Promise<void> {
  const p = prompt(session.step);
  const text = session.step === 'confirm' ? previewText(session.draft) : p.text;
  await sendMessage(env, chatId, text, p.markup);
  session.updatedAt = 0; // timestamp set by caller is not needed; KV TTL handles expiry
  await saveSession(env, chatId, session);
}

async function advance(env: Env, chatId: number, session: WizardSession): Promise<void> {
  session.step = nextStep(session.step, session.draft);
  await enter(env, chatId, session);
}

// Main entry: apply one input to the wizard, performing side effects.
export async function handleWizard(
  env: Env,
  chatId: number,
  session: WizardSession,
  input: WizardInput,
): Promise<void> {
  if (input.kind === 'callback') await answerCallback(env, input.callbackId);

  // Global cancel from the confirm step.
  if (input.kind === 'callback' && input.data === 'cancel') {
    await clearSession(env, chatId);
    await sendMessage(env, chatId, 'Cancelled.', removeKeyboard);
    return;
  }

  const d = session.draft;
  const step = session.step;
  const cb = input.kind === 'callback' ? input.data : null;
  const txt = input.kind === 'text' ? input.text.trim() : null;
  const skipped = cb === 'skip';

  switch (step) {
    case 'locale':
      if (cb?.startsWith('loc:')) {
        d.locale = cb.slice(4);
        return advance(env, chatId, session);
      }
      break;
    case 'title':
      if (txt) {
        d.title = txt;
        d.slug = await resolveSlug(ghExists(env), d.locale ?? 'en', txt);
        return advance(env, chatId, session);
      }
      break;
    case 'propertyType':
      if (cb?.startsWith('pt:')) {
        d.propertyType = cb.slice(3) as PropertyType;
        return advance(env, chatId, session);
      }
      break;
    case 'price':
      if (txt) {
        const n = parsePositiveNumber(txt);
        if (n === null) {
          await sendMessage(env, chatId, 'Please send a number, e.g. 875000.');
          return;
        }
        d.price = n;
        return advance(env, chatId, session);
      }
      break;
    case 'currency':
      if (cb?.startsWith('cur:')) {
        d.currency = cb.slice(4);
        return advance(env, chatId, session);
      }
      break;
    case 'beds':
    case 'baths':
      if (skipped) return advance(env, chatId, session);
      if (cb?.startsWith(`${step}:`)) {
        d[step] = Number(cb.split(':')[1]);
        return advance(env, chatId, session);
      }
      break;
    case 'area':
      if (skipped) return advance(env, chatId, session);
      if (txt) {
        const n = parsePositiveNumber(txt);
        if (n === null) {
          await sendMessage(env, chatId, 'Send a number or tap Skip.');
          return;
        }
        d.area = n;
        return advance(env, chatId, session);
      }
      break;
    case 'areaUnit':
      if (cb?.startsWith('au:')) {
        d.areaUnit = cb.slice(3) as AreaUnit;
        return advance(env, chatId, session);
      }
      break;
    case 'lotSize':
      if (skipped) return advance(env, chatId, session);
      if (txt) {
        const n = parsePositiveNumber(txt);
        if (n === null) {
          await sendMessage(env, chatId, 'Send a number or tap Skip.');
          return;
        }
        d.lotSize = n;
        return advance(env, chatId, session);
      }
      break;
    case 'street':
    case 'city':
    case 'region':
    case 'country':
      if (txt) {
        d.address = { ...emptyAddress(d), [step]: txt };
        return advance(env, chatId, session);
      }
      break;
    case 'coords':
      if (skipped) return advance(env, chatId, session);
      if (input.kind === 'location') {
        d.coords = { lat: input.lat, lng: input.lng };
        return advance(env, chatId, session);
      }
      break;
    case 'features':
      if (skipped) {
        d.features = [];
        return advance(env, chatId, session);
      }
      if (txt) {
        d.features = txt.split(',').map((f) => f.trim()).filter(Boolean);
        return advance(env, chatId, session);
      }
      break;
    case 'photos':
      if (cb === 'done') return advance(env, chatId, session);
      if (input.kind === 'photo') {
        await addPhoto(env, chatId, session, input.fileId);
        return;
      }
      break;
    case 'description':
      if (skipped) {
        d.description = '';
        return advance(env, chatId, session);
      }
      if (txt) {
        d.description = txt;
        return advance(env, chatId, session);
      }
      break;
    case 'status':
      if (cb?.startsWith('st:')) {
        d.status = cb.slice(3) as Status;
        return advance(env, chatId, session);
      }
      break;
    case 'confirm':
      if (cb === 'confirm') return commit(env, chatId, session);
      break;
  }

  // Unrecognized input for this step — re-show the prompt.
  await enter(env, chatId, session);
}

function emptyAddress(d: Partial<ListingFormModel>) {
  return d.address ?? { street: '', city: '', region: '', country: '' };
}

async function addPhoto(
  env: Env,
  chatId: number,
  session: WizardSession,
  fileId: string,
): Promise<void> {
  try {
    const bytes = await downloadFile(env, fileId);
    const key = buildKey('listings/photos', `${fileId}.jpg`);
    await putMedia(env, bytes, 'image/jpeg', key);
    session.draft.photos = [...(session.draft.photos ?? []), key];
    await saveSession(env, chatId, session);
    await sendMessage(
      env,
      chatId,
      `📷 Added (${session.draft.photos.length}). Send more or tap Done.`,
      inlineKeyboard([[['Done', 'done']]]),
    );
  } catch {
    await sendMessage(env, chatId, 'Could not save that photo — try again or tap Done.');
  }
}

async function commit(env: Env, chatId: number, session: WizardSession): Promise<void> {
  try {
    const entry = buildListingEntry(session.draft);
    await commitFile(env, entry.path, entry.content, `listing: add ${entry.path}`);
    await clearSession(env, chatId);
    await sendMessage(env, chatId, `✅ Created <code>${entry.path}</code>. Publishing…`, removeKeyboard);
  } catch {
    await sendMessage(env, chatId, '❌ Commit failed. Tap Confirm to retry, or /cancel.');
  }
}

// Start a fresh wizard at the first step.
export async function startWizard(env: Env, chatId: number): Promise<void> {
  const session: WizardSession = { step: 'locale', draft: {}, updatedAt: 0 };
  await enter(env, chatId, session);
}
```

> The `emptyAddress` import note: `emptyListing` is imported transitively via `_listing`, but `_wizard.ts` references `emptyAddress` locally (defined above), so no extra import is needed. `parsePositiveNumber`, `stepApplies`, `nextStep`, `STEP_ORDER`, `startWizard`, `handleWizard`, and `WizardInput` are the module's exports.

- [ ] **Step 4: Run test to verify it passes**

Run: `./node_modules/.bin/vitest run functions/telegram/_wizard.test.ts`
Expected: PASS (helper tests). Then `npm run check` → 0 errors.

- [ ] **Step 5: Commit**

```bash
git add functions/telegram/_wizard.ts functions/telegram/_wizard.test.ts
git commit -m "feat: create-listing wizard state machine"
```

---

## Task 8: Mark-status flow (`_status.ts`)

**Files:**
- Create: `functions/telegram/_status.ts`
- Test: `functions/telegram/_status.test.ts`

The flow is stateless: the listing path + chosen status ride in `callback_data`. `/status` lists recent `en` listings as buttons (`pick:<path>`); tapping one shows status buttons (`set:<status>:<path>`); tapping a status reads, edits the `status` field, and commits.

- [ ] **Step 1: Write the failing test**

Create `functions/telegram/_status.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { withStatus } from './_status';

describe('withStatus', () => {
  it('replaces the status frontmatter field, preserving the body', () => {
    const raw = `---\ntitle: X\nslug: x\nstatus: draft\nprice: 100\n---\n\nBody text.\n`;
    const out = withStatus(raw, 'sold');
    expect(out).toContain('status: sold');
    expect(out).not.toContain('status: draft');
    expect(out).toContain('Body text.');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/vitest run functions/telegram/_status.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `_status.ts`**

```ts
/// <reference types="@cloudflare/workers-types" />
import type { Env } from '../api/_env';
import { listDir, readFile, commitFile } from '../api/_github';
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
  let files;
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./node_modules/.bin/vitest run functions/telegram/_status.test.ts`
Expected: PASS (1 test). Then `npm run check` → 0 errors.

- [ ] **Step 5: Commit**

```bash
git add functions/telegram/_status.ts functions/telegram/_status.test.ts
git commit -m "feat: mark-status flow"
```

---

## Task 9: Webhook entry point (`webhook.ts`)

**Files:**
- Create: `functions/telegram/webhook.ts`
- Test: `functions/telegram/webhook.test.ts`

- [ ] **Step 1: Write the failing test (auth gates)**

Create `functions/telegram/webhook.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { onRequestPost } from './webhook';
import type { Env } from '../api/_env';

const env = {
  TELEGRAM_WEBHOOK_SECRET: 'secret',
  TELEGRAM_ALLOWED_IDS: '111,222',
} as Env;

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
```

> These tests exercise auth/allowlist branches. The `/cancel` path calls `clearSession`, which touches `env.SESSIONS`; provide a no-op stub so it doesn't throw — add `SESSIONS: { get: async () => null, put: async () => {}, delete: async () => {} }` to the test `env` cast. Update the `env` object accordingly:

```ts
const env = {
  TELEGRAM_WEBHOOK_SECRET: 'secret',
  TELEGRAM_ALLOWED_IDS: '111,222',
  TELEGRAM_BOT_TOKEN: 't',
  SESSIONS: { get: async () => null, put: async () => {}, delete: async () => {} },
} as unknown as Env;
```

(Bot API calls in `_telegram` are fire-and-forget and swallow fetch errors, so they won't fail the test even with no network.)

- [ ] **Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/vitest run functions/telegram/webhook.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `webhook.ts`**

```ts
/// <reference types="@cloudflare/workers-types" />
import type { Env } from '../api/_env';
import { loadSession, type WizardSession } from './_session';
import { handleWizard, startWizard, type WizardInput } from './_wizard';
import { listForStatus, handleStatusCallback, isStatusCallback } from './_status';
import { sendMessage, answerCallback, removeKeyboard } from './_telegram';
import { clearSession } from './_session';

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
```

> Type note: `WizardSession` is imported but only used via `loadSession`'s return; remove the unused named import if `npm run check` flags it. Keep imports minimal — `loadSession`, `clearSession` from `_session`.

- [ ] **Step 4: Run test to verify it passes**

Run: `./node_modules/.bin/vitest run functions/telegram/webhook.test.ts`
Expected: PASS (3 tests). Then `./node_modules/.bin/vitest run functions` → all green, and `npm run check` → 0 errors.

- [ ] **Step 5: Commit**

```bash
git add functions/telegram/webhook.ts functions/telegram/webhook.test.ts
git commit -m "feat: Telegram webhook entry point + routing"
```

---

## Task 10: Setup CLI (`cli/telegram-setup.mjs`)

**Files:**
- Create: `cli/telegram-setup.mjs`
- Modify: `package.json` (add a script)

- [ ] **Step 1: Implement the setup script**

Create `cli/telegram-setup.mjs`:

```js
#!/usr/bin/env node
// Registers the Telegram webhook + command menu. Run once after deploy.
// Usage: TELEGRAM_BOT_TOKEN=... TELEGRAM_WEBHOOK_SECRET=... \
//        node cli/telegram-setup.mjs https://your-site.pages.dev/telegram/webhook

const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const url = process.argv[2];

if (!token || !secret || !url) {
  console.error(
    'Required: TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET env vars and a webhook URL arg.',
  );
  process.exit(1);
}

const api = (method) => `https://api.telegram.org/bot${token}/${method}`;

async function post(method, body) {
  const res = await fetch(api(method), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(`${method} failed: ${JSON.stringify(json)}`);
  return json;
}

await post('setWebhook', {
  url,
  secret_token: secret,
  allowed_updates: ['message', 'callback_query'],
});
console.log('✓ webhook set →', url);

await post('setMyCommands', {
  commands: [
    { command: 'new', description: 'Create a new listing' },
    { command: 'status', description: 'Change a listing’s status' },
    { command: 'cancel', description: 'Cancel the current action' },
  ],
});
console.log('✓ command menu set');
```

- [ ] **Step 2: Add an npm script**

In `package.json` `scripts`, add:

```json
    "telegram:setup": "node cli/telegram-setup.mjs",
```

- [ ] **Step 3: Lint + format**

Run: `npm run lint && npm run format:check`
Expected: clean (or run `npm run format` then re-check).

- [ ] **Step 4: Commit**

```bash
git add cli/telegram-setup.mjs package.json
git commit -m "feat: telegram setup CLI (setWebhook + setMyCommands)"
```

---

## Task 11: Operator docs + full verification

**Files:**
- Create: `docs/telegram-bot.md`

- [ ] **Step 1: Write the operator guide**

Create `docs/telegram-bot.md`:

```markdown
# Telegram Listings Bot — operator setup

1. **Create the bot** with @BotFather; copy the token.
2. **Get allowed user IDs** from @userinfobot.
3. **Create the KV namespace:** `wrangler kv namespace create SESSIONS`,
   put the printed id in `wrangler.toml` under `[[kv_namespaces]]`.
4. **Set secrets:**
   - `wrangler pages secret put TELEGRAM_BOT_TOKEN`
   - `wrangler pages secret put TELEGRAM_WEBHOOK_SECRET`
5. **Set vars:** `TELEGRAM_ALLOWED_IDS` in `wrangler.toml` (comma-separated).
6. **Deploy**, then register the webhook:
   `TELEGRAM_BOT_TOKEN=... TELEGRAM_WEBHOOK_SECRET=... npm run telegram:setup -- https://<site>/telegram/webhook`
7. **Cloudflare Access:** if Access protects the whole zone, add a **bypass**
   policy for `/telegram/*` so Telegram can POST unauthenticated.

## Local dev
`/telegram/*` only runs under `wrangler pages dev` (not `astro dev`). Expose it
with a tunnel (`cloudflared tunnel --url http://localhost:8788`) and point
`setWebhook` at the tunnel URL with the same secret.

## Commands
- `/new` — guided create-listing wizard
- `/status` — flip a listing to draft/for-sale/pending/sold
- `/cancel` — abort the current wizard
```

- [ ] **Step 2: Full verification**

Run: `npm run verify`
Expected: check + lint + stylelint + format:check + test all PASS.

- [ ] **Step 3: Commit**

```bash
git add docs/telegram-bot.md
git commit -m "docs: Telegram bot operator setup guide"
```

- [ ] **Step 4: Push and confirm CI**

```bash
git push origin main
```
Then confirm both CI jobs pass:
`gh run watch "$(gh run list --limit 1 --json databaseId --jq '.[0].databaseId')" --exit-status`
Expected: `quality: success`, `a11y: success`.

---

## Manual smoke test (after deploy)

Not automatable in CI (needs a live bot). After Task 11 deploy:

1. DM the bot `/new` → step through locale → title → type → price → … → photos → confirm.
2. Verify a commit appears in `src/content/listings/<locale>/<slug>.md` with the photo R2 keys.
3. Verify the photos exist in R2 and the listing renders after the Pages rebuild.
4. `/status` → pick the listing → `sold` → verify the frontmatter `status` changed via a new commit.
5. From a non-allowlisted account, confirm the bot ignores you.

---

## Self-review

**Spec coverage:**
- Webhook outside `/api/*` → Task 9 (`functions/telegram/webhook.ts`). ✓
- Two auth gates (secret token + allowlist) → Task 9 `onRequestPost` + `allowed()`. ✓
- Always return 200 → Task 9 (all paths return `'ok'`/200; only bad secret → 401, by design before any Telegram interaction). ✓
- KV session w/ TTL + `/cancel` clears → Task 5 + Task 9. ✓
- Create wizard, all 12 spec steps incl. locale/currency/areaUnit, branch on type, location share, photo loop, preview/confirm → Task 7. ✓
- Slug auto + collision → Task 6. ✓
- Mark-status via callback_data, no KV → Task 8. ✓
- Reuse GitHub/R2 seam; extract shared helpers → Tasks 1–2; bot reuses `buildListingFile`/`serializeEntry` → Tasks 6/8. ✓
- New env bindings → Task 3. ✓
- Setup CLI (setWebhook + setMyCommands) → Task 10. ✓
- Tests (auth gate, slugify+collision, frontmatter build, wizard transitions, status swap) → Tasks 1,2,6,7,8,9. ✓
- Local dev + Access bypass notes → Task 11 docs. ✓

**Placeholder scan:** No TBD/TODO; every code step contains complete code. The only intentional placeholder is `REPLACE_WITH_KV_NAMESPACE_ID` in `wrangler.toml` (a real value the operator fills from Task 0).

**Type consistency:** `WizardStep`/`WizardSession` defined in Task 5 and used in Tasks 7/9. `WizardInput` defined+exported in Task 7, consumed in Task 9. `commitFile`/`readFile`/`listDir` defined in Task 1, used in Tasks 6/7/8. `buildKey`/`putMedia` defined in Task 2, used in Task 7. `ListingFormModel`/`emptyListing`/`slugify`/`buildListingFile` reused from `src/admin`. Callback-data prefixes are consistent across producer (prompt builders) and consumer (`handleWizard`): `loc:`,`pt:`,`cur:`,`au:`,`st:`,`beds:`,`baths:`,`skip`,`done`,`confirm`,`cancel`, and `pick:`/`set:` for status.

**Scope:** One cohesive subsystem (the bot) + a small enabling refactor. Single plan is appropriate.
