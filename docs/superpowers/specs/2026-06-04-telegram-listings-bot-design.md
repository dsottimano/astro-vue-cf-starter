# Telegram Listings Bot — Design

**Date:** 2026-06-04
**Status:** Approved, ready for implementation planning

## Goal

Let an authorized user create real-estate **listings** (with media) and flip a
listing's **status** from their phone by chatting with a Telegram bot. The bot
reuses the starter's existing content seam: media → R2, content `.md` →
committed to GitHub via the Contents API, which triggers a Cloudflare Pages
rebuild.

Non-goals (v1): editing a listing's full field set or markdown body over chat,
deleting listings, managing posts/categories/redirects, multi-locale
translation. Those stay in the web admin.

## Architecture & request flow

A new Cloudflare Pages Function at **`functions/telegram/webhook.ts`** (path
`/telegram/webhook`). It lives *outside* `functions/api/`, so the Cloudflare
Access JWT middleware (`functions/api/_middleware.ts`) never applies — the bot
carries its own auth instead.

```
Phone → Telegram → POST /telegram/webhook
  → ① verify Telegram secret-token header
  → ② check sender ID against allowlist
  → ③ load KV session for this chat
  → route to wizard step / command handler
       • text / button  → advance state machine (reply via Bot API)
       • photo          → download from Telegram, PUT to R2, store key
       • confirm        → render frontmatter, commit .md to GitHub
  → save / clear session → return 200
GitHub push → Pages rebuild → listing live
```

- **Bot API access:** raw `fetch` to `https://api.telegram.org/bot<token>/<method>`
  — no third-party library (native, per the project's dependency policy). File
  downloads use `getFile` → `file_path` →
  `https://api.telegram.org/file/bot<token>/<file_path>`.
- **Always return HTTP 200** to Telegram, even on internal errors — a non-200
  response makes Telegram retry the same update repeatedly. Errors are surfaced
  to the user via `sendMessage`, not via the HTTP status.

## Auth & config

Two independent gates:

1. **Webhook secret token** — Telegram sends the `secret_token` configured at
   `setWebhook` time in the `X-Telegram-Bot-Api-Secret-Token` header on every
   update. Compared to `TELEGRAM_WEBHOOK_SECRET`; mismatch → `401`. Stops random
   internet POSTs.
2. **Sender allowlist** — `update.message.from.id` (or `callback_query.from.id`)
   must be in `TELEGRAM_ALLOWED_IDS` (comma-separated). Otherwise the update is
   silently ignored (still returns 200).

**New environment bindings** (added to `functions/api/_env.ts`, `wrangler.toml`,
`.dev.vars.example`):

| Name | Kind | Purpose |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | secret | Bot API auth |
| `TELEGRAM_WEBHOOK_SECRET` | secret | Webhook header check |
| `TELEGRAM_ALLOWED_IDS` | var | Comma-separated allowed Telegram user IDs |
| `SESSIONS` | KV binding | Wizard session state |

Existing `GITHUB_*`, `MEDIA` (R2), `ENVIRONMENT` are reused.

**Deployment note:** if the Cloudflare Access application covers the whole zone,
add a **bypass policy for `/telegram/*`** so Telegram's POSTs are not challenged.

## The create wizard

Stateful, because Functions are stateless and the listing is built across many
messages. State lives in KV:

- Key: `wizard:<chatId>`
- Value: `{ step, draft: Partial<Listing>, photos: string[], updatedAt }`
- TTL: ~1h, refreshed on every write (abandoned wizards auto-expire).
- `/cancel` deletes the key.

Each incoming update loads the session and dispatches on `step`. Enum fields use
**inline keyboards** (tap, no typing); optional fields get a **Skip** button.

Steps:

1. **Locale** → `en` / `es` (buttons)
2. **Title** → text. Auto-derive `slug` (slugify); collision-check the target
   path via `getSha`, append `-2`/`-3`/… if taken. `translationKey = slug`.
3. **propertyType** → house / condo / lot / commercial (buttons)
4. **Price** → numeric text (re-prompt on non-numeric); **currency** defaults
   `USD` with a button to change.
5. Branch on type:
   - house / condo → **beds**, **baths**, **area** (+ `areaUnit` sqft/sqm)
   - lot / commercial → **lotSize**
   - all collected via number-pad inline keyboards / Skip.
6. **Address** → `street`, `city`, `region`, `country` (text prompts).
7. **Coords** → prompt the native **📍 Share Location** attachment (real GPS);
   Telegram delivers a `location` message → `lat`/`lng`. Skip → `0,0`
   placeholder with a "set location in the admin" note.
8. **Features** → comma-separated text / Skip → `[]`.
9. **Photos** → "send them now, tap **Done** when finished." Each photo update:
   validate type/size (shared media rules), download from Telegram, `PUT` to R2,
   append the returned key to `photos[]`. Albums arrive as multiple individual
   photo updates — no special buffering needed because the step is explicit.
10. **Description** → markdown body text / Skip → empty body.
11. **Status** → draft / for-sale / pending / sold (buttons), default `draft`.
12. **Preview** → render the assembled listing → **✅ Confirm / ✖️ Cancel**.
    Confirm → build frontmatter + body, commit
    `src/content/listings/<locale>/<slug>.md`, clear session, reply with the
    repo path / live URL.

The wizard always produces a schema-complete listing (required fields:
`title, slug, locale, translationKey, price, propertyType, address, coords`),
so it never breaks the Astro build.

## Mark-status flow

`/status`:

1. List recent listings (read `src/content/listings/<locale>` via the list
   helper) as inline buttons labeled by title.
2. User taps a listing → show status buttons (for-sale / pending / sold /
   draft).
3. User taps a status → read the file, parse frontmatter with `js-yaml`, set the
   `status` field, re-dump, commit. Reply with confirmation.

The listing path + chosen status ride in `callback_data` (paths like
`src/content/listings/en/sunny-villa.md` fit under Telegram's 64-byte limit), so
this flow needs **no KV session**.

## Code organization & reuse

New files under `functions/telegram/`:

| File | Responsibility |
|---|---|
| `webhook.ts` | Entry point: auth gates, parse update, route |
| `_telegram.ts` | Bot API client (`sendMessage`, `editMessageText`, `answerCallbackQuery`, `getFile`, download) + inline-keyboard builders |
| `_wizard.ts` | Create state machine — pure step/transition logic (unit-tested) |
| `_status.ts` | Mark-status flow |
| `_session.ts` | KV load / save / clear |
| `_listing.ts` | slugify, collision check, frontmatter + body assembly |

**Surgical refactor (shared with existing API functions):**

- Extract `commitFile(env, path, content, message)` and `readFile(env, path)`
  into the existing `functions/api/_github.ts`; `commit.ts` and `entry.ts` call
  them. No behavior change.
- Extract `buildKey`, `ALLOWED`, `MAX_BYTES`, and a `putMedia(env, ...)` helper
  from `upload.ts` into a new `functions/api/_media.ts`; `upload.ts` and the bot
  call it.

Existing tests for `commit.ts` / `entry.ts` / `upload.ts` cover the refactor.
The bot imports shared helpers via `../api/...`. (Moving shared helpers to a
`functions/_lib/` directory is a cleaner future tidy, deliberately deferred to
keep this change contained.)

## Error handling

- Any handler error → reply to the user with a readable message; still return
  200 to Telegram.
- Invalid field input (e.g. non-numeric price) → re-prompt the same step.
- Photo rejected (type/size) → tell the user, keep the photo step active.
- Commit failure → tell the user, keep the session so they can re-tap Confirm.

## Testing, local dev, deployment

- **Unit tests (vitest):** secret-token + allowlist gate; slugify + collision
  resolution; frontmatter/body assembly; wizard step transitions (pure
  functions); status field swap. Telegram / GitHub / R2 network calls mocked.
- **Local dev:** runs under `wrangler pages dev` (not `astro dev`, same
  constraint as today's `/api/*` Functions). The webhook needs a public URL — a
  tunnel (cloudflared / ngrok) pointed at the dev server, with `setWebhook`
  aimed at the tunnel.
- **Setup CLI** `cli/telegram-setup.mjs` (mirrors the existing `cli/setup.mjs`):
  registers the webhook (`setWebhook` with url + `secret_token`) and the command
  menu (`setMyCommands`: `/new`, `/status`, `/cancel`).
