import { getCollection, type CollectionEntry } from 'astro:content';
import { type Locale } from '../../config/site.config';
import { resolveLocalized } from './localized';

export { imageUrl } from './media';
export type Listing = CollectionEntry<'listings'>;

/**
 * All public listings for a locale (drafts excluded), with locale fallback.
 * Featured first, then by price descending — deterministic order.
 */
export async function getListings(locale: Locale): Promise<Listing[]> {
  const all = (await getCollection('listings')).filter((e) => e.data.status !== 'draft');
  return resolveLocalized(all, locale).sort((a, b) => {
    if (a.data.featured !== b.data.featured) return a.data.featured ? -1 : 1;
    return b.data.price - a.data.price;
  });
}
