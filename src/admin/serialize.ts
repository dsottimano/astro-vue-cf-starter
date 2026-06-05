// Maps admin form models ↔ content files. Mirrors the Zod schemas in
// src/content.config.ts. Frontmatter YAML is handled by frontmatter.ts.

import { serializeEntry, parseEntry } from './frontmatter';
import {
  emptyListing,
  emptyPost,
  type ListingFormModel,
  type PostFormModel,
  type CategoryFormModel,
  type Status,
  type PropertyType,
  type AreaUnit,
  type PostStatus,
} from './model';

// ── small coercers ───────────────────────────────────────────────────────────
const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d);
const numOrNull = (v: unknown): number | null => (typeof v === 'number' ? v : null);
const bool = (v: unknown, d = false): boolean => (typeof v === 'boolean' ? v : d);
const strArr = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
const dateStr = (v: unknown): string => {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'string') return v.slice(0, 10);
  return '';
};

export interface EntryFile {
  path: string;
  content: string;
}

// ── Listings ─────────────────────────────────────────────────────────────────
export function buildListingFile(m: ListingFormModel): EntryFile {
  const data: Record<string, unknown> = {
    title: m.title,
    slug: m.slug,
    locale: m.locale,
    translationKey: m.translationKey,
    status: m.status,
    featured: m.featured,
    price: m.price,
    currency: m.currency,
    propertyType: m.propertyType,
  };
  if (m.beds != null) data.beds = m.beds;
  if (m.baths != null) data.baths = m.baths;
  if (m.area != null) data.area = m.area;
  data.areaUnit = m.areaUnit;
  if (m.lotSize != null) data.lotSize = m.lotSize;
  data.address = m.address;
  data.coords = m.coords;
  data.features = m.features;
  data.photos = m.photos;
  data.floorplans = m.floorplans;

  return {
    path: `src/content/listings/${m.locale}/${m.slug}.md`,
    content: serializeEntry(data, m.description),
  };
}

export function parseListingFile(raw: string, fallbackLocale: string): ListingFormModel {
  const { data, body } = parseEntry(raw);
  const base = emptyListing(str(data.locale, fallbackLocale));
  const addr = (data.address ?? {}) as Record<string, unknown>;
  const coords = (data.coords ?? {}) as Record<string, unknown>;
  return {
    ...base,
    title: str(data.title),
    slug: str(data.slug),
    locale: str(data.locale, fallbackLocale),
    translationKey: str(data.translationKey),
    status: str(data.status, 'draft') as Status,
    featured: bool(data.featured),
    price: typeof data.price === 'number' ? data.price : 0,
    currency: str(data.currency, 'USD'),
    propertyType: str(data.propertyType, 'house') as PropertyType,
    beds: numOrNull(data.beds),
    baths: numOrNull(data.baths),
    area: numOrNull(data.area),
    areaUnit: str(data.areaUnit, 'sqft') as AreaUnit,
    lotSize: numOrNull(data.lotSize),
    address: {
      street: str(addr.street),
      city: str(addr.city),
      region: str(addr.region),
      country: str(addr.country),
    },
    coords: {
      lat: typeof coords.lat === 'number' ? coords.lat : 0,
      lng: typeof coords.lng === 'number' ? coords.lng : 0,
    },
    features: strArr(data.features),
    photos: strArr(data.photos),
    floorplans: strArr(data.floorplans),
    description: body,
  };
}

// ── Posts ────────────────────────────────────────────────────────────────────
export function buildPostFile(m: PostFormModel): EntryFile {
  const data: Record<string, unknown> = {
    title: m.title,
    slug: m.slug,
    locale: m.locale,
    translationKey: m.translationKey,
    status: m.status,
    publishDate: m.publishDate,
    excerpt: m.excerpt,
    coverImage: m.coverImage,
    categories: m.categories,
  };
  return {
    path: `src/content/posts/${m.locale}/${m.slug}.md`,
    content: serializeEntry(data, m.body),
  };
}

export function parsePostFile(raw: string, fallbackLocale: string): PostFormModel {
  const { data, body } = parseEntry(raw);
  const base = emptyPost(str(data.locale, fallbackLocale));
  return {
    ...base,
    title: str(data.title),
    slug: str(data.slug),
    locale: str(data.locale, fallbackLocale),
    translationKey: str(data.translationKey),
    status: str(data.status, 'draft') as PostStatus,
    publishDate: dateStr(data.publishDate),
    excerpt: str(data.excerpt),
    coverImage: str(data.coverImage),
    categories: strArr(data.categories),
    body,
  };
}

// ── Categories (plain JSON data files) ───────────────────────────────────────
export function buildCategoryFile(m: CategoryFormModel): EntryFile {
  const data: Record<string, unknown> = { slug: m.slug, name: m.name };
  if (m.parent) data.parent = m.parent;
  return {
    path: `src/content/categories/${m.slug}.json`,
    content: JSON.stringify(data, null, 2) + '\n',
  };
}

export function parseCategoryFile(raw: string): CategoryFormModel {
  const data = JSON.parse(raw) as Record<string, unknown>;
  const name = (data.name ?? {}) as Record<string, string>;
  return { slug: str(data.slug), parent: str(data.parent), name };
}
