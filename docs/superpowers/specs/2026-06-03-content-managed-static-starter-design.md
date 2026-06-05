# Design: Content-Managed Static-Site Starter (`astro-vue-cf-starter`)

**Date:** 2026-06-03
**Status:** Approved (design phase)

## Purpose

A reusable, **business-agnostic** starter pack for content-managed static sites. It replaces the old two-app stack (11ty static front end + a separate Vue SPA admin + GitHub-as-CMS) that was rebuilt roughly twice. The goal is to build the **plumbing once** and clone it for any business — real estate, product catalog, portfolio, directory, etc.

The first example content type is a real-estate "listing," but nothing in the plumbing is real-estate-specific. Swapping the field definitions, admin form, and display templates turns it into a different business.

## Non-Goals

- No runtime database. Content is read-heavy and rarely changing; static output is faster, cheaper, and has a far smaller attack surface.
- No off-the-shelf git CMS (Decap/Sveltia/Tina). They handle heavy, client-managed media (20+ photos, galleries, floorplans) poorly, and the editing UX is worse than a custom admin.
- No schema-driven dynamic form engine (yet). We build an **explicit, hand-written** example content type (Approach B). A schema-driven layer can emerge later only if duplication actually becomes painful.

## Architecture

One repo, one build, one deploy.

```
Browser (client) ─┬─ public static site  (Astro → dist/, served by Cloudflare Pages)
                  └─ /admin  (Vue island, client-only)
                         │  fetch()
                         ▼
              Pages Functions  (/functions, gated by Cloudflare Access)
                  ├─ /api/commit  → GitHub Contents API (PUT) → push → Pages rebuild
                  └─ /api/upload  → R2 bucket (binding) → returns key
```

Content is the source of truth in git. The admin never talks to a database — it commits entry files (via GitHub) and pushes image blobs (to R2). Every static benefit is preserved.

## Repo Layout

```
src/
  content/listings/<locale>/   # example type: per-locale entry files (.md, frontmatter = fields)
  content.config.ts            # Astro collection schema (Zod) — explicit, hand-written
  i18n/                        # UI string dictionaries (en.json, es.json, ...)
  styles/theme.css             # single design-token file (CSS vars) — drives Tailwind + dark mode
  pages/
    [locale]/index.astro       # localized list page
    [locale]/listings/[slug].astro  # localized detail page
    admin/index.astro          # mounts <AdminApp client:only="vue" />
    404.astro  500.astro       # error templates
  admin/                       # custom Vue admin (the editing UI)
    AdminApp.vue
    ListingForm.vue            # explicit form for the example type — copy+edit per business
  components/
    SEO.astro                  # meta/OG/Twitter + JSON-LD schema
    ThemeToggle.vue            # light/dark switch
  layouts/
config/
  site.config.ts               # site name, locales, default locale, base URL, theme defaults
  redirects.config.ts          # source → destination → compiled to _redirects
functions/api/
  commit.ts   upload.ts        # the two write endpoints
cli/
  setup.mjs                    # interactive setup CLI
public/
  robots.txt
astro.config.mjs  tailwind.config.cjs  wrangler.toml  package.json
.eslintrc / prettier / stylelint / html-validate configs
```

## Components

### Generic plumbing (build once, never touch per business)

1. **Astro static build → Cloudflare Pages.** Static-first, file-based, deploys to Pages.
2. **Admin auth.** Cloudflare Access (Zero Trust) gates `/admin` and `/api/*` — no auth code in-app. Free up to 50 users.
3. **`/api/commit`.** Receives `{ path, content }`, commits via the GitHub Contents API (PUT) using a fine-grained PAT stored as a Pages secret. Push triggers a Pages rebuild. Content-agnostic.
4. **`/api/upload`.** Receives a file, `put`s it to the R2 bucket (binding), returns `{ key, url }`. Binaries never enter git. Front end renders images from R2 via a public bucket domain.
5. **Content-collection wiring.** Astro reads entry files at build time and generates list + detail pages.

### The one business-specific seam

The **field definitions** + the **admin form** + the **display templates**. Built explicitly (Approach B) so every wire is readable and copy-able. New business = copy the type, rewrite the fields.

### Example content type (real-estate listing, mixed homes/land)

Fields: `title`, `slug` (auto from title), `status` (draft/for-sale/pending/sold), `price` (+currency), `propertyType` (house/condo/lot/commercial), `beds`, `baths`, `area` (+unit), `lotSize`, `address` (street/city/region/country), `coords` (lat/lng), `description` (markdown body), `features` (list), `photos` (R2 keys), `floorplans` (R2 keys), `featured` (bool).

Explicit Zod schema in `content.config.ts`; explicit Vue form in `ListingForm.vue`.

## Cross-Cutting Features (baked into the starter)

- **Theming / dark mode.** `styles/theme.css` holds design tokens as CSS variables; Tailwind consumes them. Light/dark via `prefers-color-scheme` + a persisted toggle (`ThemeToggle.vue`).
- **Accessibility (WCAG).** Semantic templates; `eslint-plugin-jsx-a11y` / Astro a11y rules; an axe check in CI.
- **Linting / code style.** ESLint + Prettier + Stylelint, enforced by a pre-commit git hook and CI. `@astrojs/check` type-checks `.astro` files in CI.
- **Strict HTML.** `html-validate` in CI fails the build on invalid or non-semantic markup.
- **DRY.** Shared layouts/components; one source each for tokens, site config, and SEO defaults.
- **SEO.** `<SEO>` component (title/description/OG/Twitter), `@astrojs/sitemap` (XML sitemap), JSON-LD structured data per content type, `robots.txt`.
- **Redirect manager.** `config/redirects.config.ts` → compiled to Cloudflare `_redirects` at build. Config-file-based (not an admin UI for now).
- **Error pages.** `404.astro` + custom `500.astro`.
- **Icons.** `astro-icon` — build-time SVG icon system (no icon font shipped).
- **Build optimization.** `astro-compress` — minifies HTML/CSS/JS/SVG in `dist/` on build.
- **Setup CLI.** `cli/setup.mjs` — interactive prompts for GitHub repo/token, R2 bucket, Cloudflare Access, site name, locales, theme → writes `.dev.vars`, `wrangler.toml`, and `config/site.config.ts`.

## Internationalization (full content translation)

- **Routing:** Astro's built-in i18n with locale-prefixed routes (`/en/...`, `/es/...`).
- **UI strings:** per-locale dictionaries in `src/i18n/`.
- **Content:** each entry has per-locale versions stored under `src/content/listings/<locale>/`, linked across languages by a shared `slug`/`translationKey`. The admin edits each language; missing translations fall back to the default locale.
- Locales and default locale are declared once in `config/site.config.ts`.

## Data Flow

- **Edit content:** admin → `POST /api/commit` `{ path, content }` → GitHub commit → push → Pages rebuild → site updates.
- **Upload image:** admin → `POST /api/upload` (multipart) → R2 `put` → returns `{ key, url }` → admin stores key in the entry's `photos`/`floorplans` → commits the entry.
- **Render image:** front end builds R2 public URLs from stored keys.

## Auth & Local Bypass

Cloudflare Access gates `/admin` and `/api/*` in production. Functions verify the Access JWT in prod and **bypass when `ENVIRONMENT=development`** (set in `.dev.vars`), so local dev needs no login.

## Dev / Build / Deploy

- **Dev:** target ≤2 processes (Astro dev w/ Vue island HMR + wrangler for Functions/R2) under one `npm run dev`.
- **Build:** `astro build` → `dist/` (also compiles `_redirects`, sitemap, robots).
- **Deploy:** Cloudflare Pages, auto on push.

## Testing

Kept light for a starter: Vitest tests on `commit`/`upload` request parsing; CI runs lint + a11y (axe) + `html-validate`. No heavy suite.

## Implementation Phasing

1. **Core plumbing** — Astro static + Pages, example type (schema + templates + admin form), `/api/commit`, `/api/upload`, R2, Access + local bypass.
2. **Quality layer** — theme.css + dark mode, SEO component + sitemap + robots + JSON-LD, redirects, 4xx/5xx pages, linters + a11y + html-validate + git hook/CI.
3. **i18n** — locale routing, UI dictionaries, per-locale content + admin editing.
4. **Setup CLI** — interactive bootstrap.

## Execution Mode

Dave is rebuilding his hands-on coding skill. Work in **pair mode (Mode 2)**: Claude scaffolds structure, config, and boilerplate and leaves the meaningful logic as clearly-marked blanks with notes; Dave fills them; review together. Explain the *why* before the *how*; small runnable steps; ask before generating large chunks.

## Open Implementation-Time Details (not blockers)

1. Exact dev-server wiring (Astro dev + wrangler pages dev vs. the Cloudflare adapter's `platformProxy`).
2. Whether local admin edits commit to a dev branch vs. `main`.
3. R2 public access: public bucket custom domain vs. Cloudflare image resizing.
