# Architecture

How the starter actually works, for developers and operators. For day-to-day
content editing see the [admin wiki](admin-wiki/index.md); for bot setup see
[telegram-bot.md](telegram-bot.md).

## Core idea: content is git, the site is static

The site is a **static Astro build**. There is no database and no server-side
rendering of content. Instead:

1. Content is **Markdown/JSON files committed to a GitHub repo**.
2. Editors (the web admin or the Telegram bot) don't write to a DB — they
   **commit files** through the GitHub Contents API.
3. Each push **triggers a Cloudflare Pages build**, which regenerates `dist/`.
4. **Binary media** (photos, PDFs) never enters git — it's stored in **Cloudflare
   R2** and referenced by object key.

This gives you versioned content, trivial rollbacks (git revert), a fast static
site, and no runtime database to operate. The cost is that content changes are
**not instant** — they appear after the build finishes (typically a minute or
two).

```
Editor (admin UI or Telegram)
      │  writes
      ▼
GitHub repo  ──push──►  Cloudflare Pages build  ──►  dist/  ──►  live site (CDN)
      ▲
      │  media bypasses git
      ▼
Cloudflare R2  ──►  served from siteConfig.r2PublicBase
```

## The "business seam"

Almost everything is content-agnostic plumbing. The one place a new business
customizes is:

- **`src/content.config.ts`** — the Zod schemas for `listings`, `posts`,
  `categories`. Rewrite the `listings` fields and the matching `ListingForm.vue`
  for a different domain.
- **`config/site.config.ts`** — name, URL, locales, R2 public base, theme.

Everything in `functions/`, the admin shell, and the publishing pipeline stays
the same.

## Components

### Public site (Astro, static)

- `output: 'static'`, built to `dist/`, served by Cloudflare Pages.
- **i18n**: `astro` built-in, locale-prefixed routes (`/en/…`, `/es/…`),
  `prefixDefaultLocale: true`. The bare `/` is redirected to the default locale.
- **Content collections** loaded via the glob loader from `src/content/`. Note
  `generateId` keeps the locale prefix so the same slug in two locales doesn't
  collide.
- **Routes**: `/<locale>/`, `/<locale>/listings/<slug>`, `/<locale>/blog`,
  `/<locale>/blog/<slug>`, `/<locale>/blog/category/<cat>`, plus `404`/`500`,
  `robots.txt`, and a sitemap.
- Build extras: `@astrojs/sitemap`, `astro-icon`, `@playform/compress` (JS/CSS/SVG
  minified; HTML left unminified so `html-validate` sees faithful markup).

### Redirects

`config/redirects.json` is the source of truth (editable in the admin). The
`integrations/emit-redirects.ts` Astro integration compiles it (plus the root →
default-locale redirect) into `dist/_redirects` at build time, which Cloudflare
Pages serves natively.

### Admin island (Vue, client-only)

- Mounted at **`/admin`** (`src/pages/admin/index.astro`) as
  `<AdminApp client:only="vue">`. It never renders at build time — it's a SPA that
  talks to runtime Functions. Marked `noindex`.
- **WordPress-style shell** (`src/admin/components/AdminLayout.vue`): sidebar nav
  for Dashboard / Listings / Posts / Categories / Redirects.
- **Routing**: a hand-rolled **hash router** (`src/admin/useRoute.ts`), e.g.
  `#/listings`, `#/listings/edit/en/sunny-villa`. (No vue-router — avoids Astro
  `appEntrypoint` coupling across islands.)
- **Data layer**: `src/admin/api.ts` is a thin client over `/api/*`; calls carry
  the Cloudflare Access session cookie.
- **Serialization**: `src/admin/serialize.ts` + `frontmatter.ts` map form models
  ↔ Markdown files (YAML frontmatter via `js-yaml`). These pure modules are the
  single source of truth for the on-disk format — **the Telegram bot reuses
  them**, so the admin and bot always produce identical files.

### API Functions (`functions/api/`)

Cloudflare Pages Functions, content-agnostic:

| Route | Method | Purpose |
|---|---|---|
| `/api/list?dir=…` | GET | List files in a content directory |
| `/api/entry?path=…` | GET / DELETE | Read or delete one file |
| `/api/commit` | POST | Create/update a file (commit to GitHub) |
| `/api/upload` | POST (multipart) | Put a binary to R2, return its key |

Shared helpers:

- **`_github.ts`** — `contentsUrl`, `ghHeaders`, `getSha`, `toBase64`/`fromBase64`,
  `isUnsafePath`, and the higher-level `commitFile`, `readFile`, `listDir`.
- **`_media.ts`** — `ALLOWED` types, `MAX_BYTES` (15 MB), `buildKey`, `putMedia`.
- **`_env.ts`** — the typed `Env` (bindings + secrets).

### Auth

- **`functions/api/_middleware.ts`** gates every `/api/*` request. In production it
  verifies the **Cloudflare Access JWT** (`Cf-Access-Jwt-Assertion`) against the
  team JWKS + audience. Locally, `ENVIRONMENT=development` bypasses it.
- **`/admin` and `/api/*` sit behind a Cloudflare Access application** (the edge
  gate); the middleware is defense-in-depth behind it.
- The **Telegram bot is outside `/api/*`**, so the Access middleware doesn't apply
  — it carries its own auth (below). If Access covers the whole zone, add a
  **bypass for `/telegram/*`**.

### Telegram bot (`functions/telegram/`)

A single webhook Function plus focused modules:

| File | Responsibility |
|---|---|
| `webhook.ts` | Entry point: auth gates, parse the Telegram update, route it |
| `_telegram.ts` | Bot API client (raw `fetch`) + inline-keyboard builders |
| `_session.ts` | Wizard session state in **KV** (`SESSIONS`), keyed by chat, 1h TTL |
| `_wizard.ts` | The create-listing state machine (locale → … → confirm) |
| `_status.ts` | The `/status` flow (flip a listing's status) |
| `_listing.ts` | Slug resolution + finalizing a draft into a schema-valid listing |

**Two auth gates** (both required):
1. `X-Telegram-Bot-Api-Secret-Token` header must equal `TELEGRAM_WEBHOOK_SECRET`
   (set when registering the webhook). Mismatch → 401.
2. The sender's Telegram user id must be in `TELEGRAM_ALLOWED_IDS`. Otherwise the
   update is silently ignored.

The webhook **always returns HTTP 200** (except a bad secret token → 401) so
Telegram never retry-storms; errors are surfaced to the user via a message.

**Create flow**: a wizard collects fields step by step (enums as inline buttons,
coords via Telegram's native location share, photos collected then uploaded to R2
via `putMedia`). On confirm it builds the listing with the admin's
`buildListingFile` and commits it with `commitFile`.

**Status flow**: stateless — `/status` lists recent listings as buttons; the
chosen listing + status ride in `callback_data` (only the slug, to stay under
Telegram's 64-byte limit; the path is reconstructed and `isUnsafePath`-checked
server-side).

### Setup CLIs (`cli/`)

- `setup.mjs` — per-business setup (rewrites `config/site.config.ts` etc.).
- `telegram-setup.mjs` — calls `setWebhook` (with the secret token) and
  `setMyCommands` (`/new`, `/status`, `/cancel`). Run via
  `npm run telegram:setup -- <webhook-url>`.

## Environment & bindings

Defined in `functions/api/_env.ts`, configured in `wrangler.toml` / secrets:

| Name | Kind | Purpose |
|---|---|---|
| `MEDIA` | R2 bucket | Uploaded media |
| `SESSIONS` | KV namespace | Telegram wizard sessions |
| `GITHUB_TOKEN` | secret | Fine-grained PAT (repo contents write) |
| `GITHUB_REPO`, `GITHUB_BRANCH` | var | Commit target |
| `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD` | var | Access JWT verification |
| `ENVIRONMENT` | var | `development` bypasses Access locally |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` | secret | Bot auth |
| `TELEGRAM_ALLOWED_IDS` | var | Comma-separated allowed Telegram user ids |

## Local development

- `astro dev` serves the **public site only** — it does **not** run Pages
  Functions. The admin and bot will 404 there.
- To run Functions locally: `npm run build` then `npx wrangler pages dev dist`,
  with a `.dev.vars` (`ENVIRONMENT=development` to skip Access). For the bot, point
  a tunnel (cloudflared/ngrok) at the Wrangler port and `setWebhook` to it.

## Testing & CI

- **Vitest** unit tests live next to the Functions (`*.test.ts`). They cover
  request parsing/validation, the GitHub/media helpers, slug resolution,
  frontmatter round-tripping, wizard step transitions, the status field swap, and
  the webhook auth gates (with `fetch` stubbed). The live multi-message bot
  conversation is covered by a documented manual smoke test, not CI.
- **CI** (`.github/workflows/ci.yml`): a `quality` job (`check`, `lint`,
  `stylelint`, `format:check`, `test`, `build`, `validate:html`) and an `a11y` job
  (axe via `pa11y-ci` against the built site; Chrome runs with `--no-sandbox` for
  GitHub's runners).

## Notable deviations / decisions

- **Tailwind v4** via `@tailwindcss/vite` (CSS-first `@theme`), not a JS config.
- Admin uses a **hand-rolled hash router**, not vue-router.
- HTML minification is **off** by design (faithful markup for `html-validate`).
- The **bot reuses the admin's serialization** rather than duplicating it.
- The **`/status` list labels by slug** (not title) to avoid an extra GitHub read
  per listing — a deliberate performance tradeoff.
