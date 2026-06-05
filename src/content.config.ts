import { defineCollection } from 'astro:content';
import { z } from 'astro:schema';
import { glob } from 'astro/loaders';

// ─────────────────────────────────────────────────────────────────────────────
// THE business-specific seam (Approach B: explicit, hand-written).
// New business = copy this file, rewrite the fields + the matching ListingForm.
// Everything else in the starter is content-agnostic plumbing.
// ─────────────────────────────────────────────────────────────────────────────

const address = z.object({
  street: z.string(),
  city: z.string(),
  region: z.string(),
  country: z.string(),
});

const coords = z.object({
  lat: z.number(),
  lng: z.number(),
});

const listings = defineCollection({
  // Per-locale entry files: src/content/listings/<locale>/<slug>.md
  // generateId keeps the locale prefix so the same slug in two locales doesn't
  // collide on a filename-only id (e.g. "en/sunny-villa" vs "es/sunny-villa").
  loader: glob({
    pattern: '**/[^_]*.md',
    base: './src/content/listings',
    generateId: ({ entry }) => entry.replace(/\.md$/, ''),
  }),
  schema: z.object({
    title: z.string(),
    // slug + locale are explicit so routing never has to parse the file path.
    slug: z.string(),
    locale: z.string(),
    // Links the same listing across languages; missing translations fall back
    // to the default locale (see src/lib/listings.ts).
    translationKey: z.string(),

    status: z.enum(['draft', 'for-sale', 'pending', 'sold']).default('draft'),
    featured: z.boolean().default(false),

    price: z.number().nonnegative(),
    currency: z.string().default('USD'),

    propertyType: z.enum(['house', 'condo', 'lot', 'commercial']),
    // Optional: land/lots have no beds/baths.
    beds: z.number().int().nonnegative().optional(),
    baths: z.number().nonnegative().optional(),
    area: z.number().nonnegative().optional(),
    areaUnit: z.enum(['sqft', 'sqm']).default('sqft'),
    lotSize: z.number().nonnegative().optional(),

    address,
    coords,

    features: z.array(z.string()).default([]),

    // R2 object keys (NOT urls) — front end builds public URLs from these.
    photos: z.array(z.string()).default([]),
    floorplans: z.array(z.string()).default([]),
  }),
  // NOTE: `description` (markdown body) is the file body, available as
  // `render(entry)` — it is intentionally not a frontmatter field.
});

// ── Blog posts ───────────────────────────────────────────────────────────────
const posts = defineCollection({
  loader: glob({
    pattern: '**/[^_]*.md',
    base: './src/content/posts',
    generateId: ({ entry }) => entry.replace(/\.md$/, ''),
  }),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    locale: z.string(),
    translationKey: z.string(),
    status: z.enum(['draft', 'published']).default('draft'),
    publishDate: z.coerce.date(),
    excerpt: z.string().optional(),
    coverImage: z.string().optional(), // R2 key
    // Category slugs (see the `categories` data collection below).
    categories: z.array(z.string()).default([]),
  }),
  // `body` (markdown) is the post content, via render(entry).
});

// ── Categories (managed taxonomy, stored as data files) ──────────────────────
const categories = defineCollection({
  // src/content/categories/<slug>.json — id === slug.
  loader: glob({ pattern: '*.json', base: './src/content/categories' }),
  schema: z.object({
    slug: z.string(),
    // Per-locale display labels: { en: "News", es: "Noticias" }.
    name: z.record(z.string(), z.string()),
    // Optional parent slug for nesting (one level is enough for the starter).
    parent: z.string().optional(),
  }),
});

export const collections = { listings, posts, categories };
