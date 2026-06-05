// Single source of truth for site-wide, business-agnostic settings.
// The Setup CLI (Phase 4) rewrites these values per business.

export const siteConfig = {
  name: 'Acme Listings',
  // Used for absolute URLs (sitemap, OG tags, JSON-LD). No trailing slash.
  url: 'https://example.com',

  locales: ['en', 'es'] as const,
  defaultLocale: 'en' as const,

  // Public base for R2 objects. Front end builds image URLs as
  // `${r2PublicBase}/${key}`. (Open Detail #3: public bucket domain vs.
  // Cloudflare image resizing — swap this base when that's decided.)
  r2PublicBase: 'https://media.example.com',

  theme: {
    // Default color mode when the visitor has no stored preference.
    defaultMode: 'system' as 'light' | 'dark' | 'system',
  },
} as const;

export type Locale = (typeof siteConfig.locales)[number];

export function isLocale(value: string): value is Locale {
  return (siteConfig.locales as readonly string[]).includes(value);
}
