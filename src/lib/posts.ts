import { getCollection, type CollectionEntry } from 'astro:content';
import { type Locale } from '../../config/site.config';
import { resolveLocalized } from './localized';

export type Post = CollectionEntry<'posts'>;

/** Public posts for a locale (drafts excluded), newest first, locale fallback. */
export async function getPosts(locale: Locale): Promise<Post[]> {
  const all = (await getCollection('posts')).filter((e) => e.data.status !== 'draft');
  return resolveLocalized(all, locale).sort(
    (a, b) => b.data.publishDate.getTime() - a.data.publishDate.getTime(),
  );
}

/** Public posts in a category, for a locale. */
export async function getPostsByCategory(locale: Locale, categorySlug: string): Promise<Post[]> {
  return (await getPosts(locale)).filter((p) => p.data.categories.includes(categorySlug));
}
