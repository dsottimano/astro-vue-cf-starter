# Astro + Vue + Cloudflare Pages — Content-Managed Listings Starter

A static-first website with a built-in, WordPress-style admin and a Telegram bot
for managing content from your phone. Built for bilingual real-estate **listings**
plus a **blog**, but the plumbing is content-agnostic.

- **Astro 6** static site (`output: 'static'`) → built to `dist/`, served by **Cloudflare Pages**
- **Vue 3** admin island at `/admin` (WordPress-style editor, client-only)
- **Tailwind v4** (CSS-first theming)
- **Content lives in git**: the admin and bot commit Markdown/JSON to GitHub via the
  Contents API; each push triggers a Pages rebuild
- **Media lives in R2**: images/PDFs upload to a Cloudflare R2 bucket, served from a public base URL
- **Telegram bot** at `/telegram/webhook` to create listings (with photos) and change their status from a phone
- **Auth** via Cloudflare Access (admin) + a secret-token/allowlist gate (bot)

## How it works in one picture

```
            ┌──────────── you ────────────┐
            │                              │
        web admin (/admin)          Telegram bot (phone)
            │                              │
            ▼                              ▼
     /api/* Pages Functions        /telegram/webhook Function
   (commit, list, entry, upload)   (wizard + status flow)
            │        │                     │   │
            │        └────── media ────────┼───┘
            ▼                              ▼   ▼
      GitHub repo (Markdown/JSON)     Cloudflare R2 (images)
            │
            ▼  (push triggers a build)
     Astro build → dist/ → Cloudflare Pages (live site)
```

Content changes are **git commits**, so everything is versioned and the live site
is rebuilt automatically. Media never enters git — it goes to R2 and is referenced
by key. See [docs/architecture.md](docs/architecture.md) for the full picture.

## Quickstart

```bash
npm install
npm run dev            # Astro dev server at http://localhost:4321
```

> ⚠️ `npm run dev` (plain `astro dev`) serves the **public site only**. The admin
> and bot rely on Cloudflare Pages Functions (`/api/*`, `/telegram/*`), which
> `astro dev` does **not** run. To exercise the admin/bot locally, build and use
> Wrangler:
>
> ```bash
> npm run build
> npx wrangler pages dev dist     # serves the site AND the Functions
> ```
>
> Create a `.dev.vars` (copy `.dev.vars.example`) with `ENVIRONMENT=development`
> to bypass Cloudflare Access locally.

## NPM scripts

| Script                            | What it does                                                   |
| --------------------------------- | -------------------------------------------------------------- |
| `npm run dev`                     | Astro dev server (public site only — no Functions)             |
| `npm run build`                   | Build the static site to `dist/`                               |
| `npm run preview`                 | Preview the built site                                         |
| `npm run check`                   | `astro check` (type-check `.astro`/`.ts`)                      |
| `npm run lint`                    | ESLint                                                         |
| `npm run stylelint`               | Stylelint (CSS)                                                |
| `npm run format` / `format:check` | Prettier write / check                                         |
| `npm run validate:html`           | html-validate against `dist/`                                  |
| `npm run test`                    | Vitest (Functions unit tests)                                  |
| `npm run verify`                  | check + lint + stylelint + format:check + test (the full gate) |
| `npm run setup`                   | Per-business setup CLI (rewrites `config/site.config.ts` etc.) |
| `npm run telegram:setup -- <url>` | Register the Telegram webhook + command menu                   |

> Note: the git pre-commit hook runs `check + lint + test` but **not**
> `format:check`/`stylelint`. Run `npm run format` before pushing — CI's quality
> job runs `format:check` and will fail on drift.

## Configuration

| Where                   | What                                                                                                                                                             |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `config/site.config.ts` | Site name, URL, locales (`en`/`es`), default locale, R2 public base, theme. **Starter ships with placeholders (`example.com`, `Acme Listings`) — change these.** |
| `src/content.config.ts` | The content schemas (listings, posts, categories). This is the business-specific seam — rewrite the fields for a new business.                                   |
| `config/redirects.json` | Redirect rules (also editable in the admin). Compiled to `dist/_redirects` at build.                                                                             |
| `wrangler.toml`         | Cloudflare bindings + non-secret vars (R2 bucket, KV namespace, GitHub repo/branch, Telegram allowlist).                                                         |
| `.dev.vars`             | Local secrets for `wrangler pages dev` (gitignored; see `.dev.vars.example`).                                                                                    |

Secrets (never in git) are set with Wrangler:

```bash
wrangler pages secret put GITHUB_TOKEN            # fine-grained PAT, repo contents write
wrangler pages secret put TELEGRAM_BOT_TOKEN      # from @BotFather
wrangler pages secret put TELEGRAM_WEBHOOK_SECRET # random string
```

## Content model

| Collection     | Location                                  | Purpose                                                                                               |
| -------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **listings**   | `src/content/listings/<locale>/<slug>.md` | Real-estate listings (price, type, beds/baths, address, coords, photos, features; body = description) |
| **posts**      | `src/content/posts/<locale>/<slug>.md`    | Blog posts (publish date, excerpt, cover image, categories; body = article)                           |
| **categories** | `src/content/categories/<slug>.json`      | Managed blog taxonomy (per-locale names, optional parent)                                             |

Routes: `/<locale>/`, `/<locale>/listings/<slug>`, `/<locale>/blog`,
`/<locale>/blog/<slug>`, `/<locale>/blog/category/<cat>`. Locales are always
prefixed (`/en/…`, `/es/…`); `/` redirects to the default locale.

## Deploy

1. Connect the repo to **Cloudflare Pages** (build command `npm run build`, output `dist`).
2. Create the **R2 bucket** and bind it as `MEDIA`; create the **KV namespace** (`wrangler kv namespace create SESSIONS`) and put its id in `wrangler.toml`.
3. Set the **vars** in `wrangler.toml` (`GITHUB_REPO`, `GITHUB_BRANCH`, `CF_ACCESS_*`, `TELEGRAM_ALLOWED_IDS`) and the **secrets** above.
4. Put **`/admin` and `/api/*` behind Cloudflare Access**; add an Access **bypass** for `/telegram/*` (the bot has its own auth).
5. Register the bot: `npm run telegram:setup -- https://<your-site>/telegram/webhook`.

Full operator steps for the bot: [docs/telegram-bot.md](docs/telegram-bot.md).

## Documentation

- **[docs/architecture.md](docs/architecture.md)** — how the whole system fits together (developers/operators)
- **[docs/admin-wiki/index.md](docs/admin-wiki/index.md)** — the mini wiki for content editors (non-technical)
- **[docs/telegram-bot.md](docs/telegram-bot.md)** — operator setup for the Telegram bot
- `docs/superpowers/specs/` and `docs/superpowers/plans/` — design specs and implementation plans

## Project structure

```
config/            site.config.ts, redirects.json
integrations/      emit-redirects.ts (redirects.json → dist/_redirects)
cli/               setup.mjs (business setup), telegram-setup.mjs (bot webhook)
src/
  content.config.ts   collection schemas (the business seam)
  content/            listings/ posts/ categories/  (the actual content, in git)
  pages/              public routes + /admin
  admin/              Vue admin island (views/, components/, api.ts, serialize.ts…)
  lib/                listings.ts, posts.ts, categories.ts, media.ts…
functions/
  api/                commit, list, entry, upload + shared _github/_media + _middleware (auth)
  telegram/           webhook + _wizard, _status, _session, _telegram, _listing
docs/                 this documentation
```
