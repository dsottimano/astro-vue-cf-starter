// The admin form model — the editable shape of one listing entry.
// Keep this in lockstep with the Zod schema in src/content.config.ts.

export type Status = 'draft' | 'for-sale' | 'pending' | 'sold';
export type PropertyType = 'house' | 'condo' | 'lot' | 'commercial';
export type AreaUnit = 'sqft' | 'sqm';

export interface ListingFormModel {
  title: string;
  slug: string;
  locale: string;
  translationKey: string;
  status: Status;
  featured: boolean;
  price: number;
  currency: string;
  propertyType: PropertyType;
  beds: number | null;
  baths: number | null;
  area: number | null;
  areaUnit: AreaUnit;
  lotSize: number | null;
  address: { street: string; city: string; region: string; country: string };
  coords: { lat: number; lng: number };
  features: string[];
  photos: string[];
  floorplans: string[];
  description: string;
}

export function emptyListing(locale: string): ListingFormModel {
  return {
    title: '',
    slug: '',
    locale,
    translationKey: '',
    status: 'draft',
    featured: false,
    price: 0,
    currency: 'USD',
    propertyType: 'house',
    beds: null,
    baths: null,
    area: null,
    areaUnit: 'sqft',
    lotSize: null,
    address: { street: '', city: '', region: '', country: '' },
    coords: { lat: 0, lng: 0 },
    features: [],
    photos: [],
    floorplans: [],
    description: '',
  };
}

// "Sunny Villa!" -> "sunny-villa"
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ── Blog post ────────────────────────────────────────────────────────────────
export type PostStatus = 'draft' | 'published';

export interface PostFormModel {
  title: string;
  slug: string;
  locale: string;
  translationKey: string;
  status: PostStatus;
  publishDate: string; // YYYY-MM-DD
  excerpt: string;
  coverImage: string; // R2 key
  categories: string[]; // category slugs
  body: string;
}

export function emptyPost(locale: string): PostFormModel {
  return {
    title: '',
    slug: '',
    locale,
    translationKey: '',
    status: 'draft',
    publishDate: '',
    excerpt: '',
    coverImage: '',
    categories: [],
    body: '',
  };
}

// ── Category (managed taxonomy) ───────────────────────────────────────────────
export interface CategoryFormModel {
  slug: string;
  parent: string;
  // Per-locale labels keyed by locale code.
  name: Record<string, string>;
}

export function emptyCategory(locales: readonly string[]): CategoryFormModel {
  return {
    slug: '',
    parent: '',
    name: Object.fromEntries(locales.map((l) => [l, ''])),
  };
}
