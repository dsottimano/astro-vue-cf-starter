import { getCollection, type CollectionEntry } from 'astro:content';
import { type Locale } from '../../config/site.config';

export type Category = CollectionEntry<'categories'>;

export async function getCategories(): Promise<Category[]> {
  return getCollection('categories');
}

/** Localized label for a category, falling back to any label, then the slug. */
export function categoryName(cat: Category, locale: Locale): string {
  return cat.data.name[locale] ?? Object.values(cat.data.name)[0] ?? cat.data.slug;
}
