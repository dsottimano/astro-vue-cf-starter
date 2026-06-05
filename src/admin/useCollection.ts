import { ref } from 'vue';
import { api } from './api';
import { siteConfig } from '../../config/site.config';

// Lists a per-locale markdown collection (listings/posts) across all locales,
// so the admin can show every entry with its locale + slug.
export interface CollectionItem {
  locale: string;
  slug: string;
  path: string;
}

export function useCollection(typeDir: string) {
  const items = ref<CollectionItem[]>([]);
  const loading = ref(false);
  const error = ref('');

  async function load() {
    loading.value = true;
    error.value = '';
    try {
      const all: CollectionItem[] = [];
      for (const locale of siteConfig.locales) {
        const entries = await api.list(`src/content/${typeDir}/${locale}`);
        for (const e of entries) {
          all.push({ locale, slug: e.name.replace(/\.md$/, ''), path: e.path });
        }
      }
      items.value = all.sort((a, b) => a.slug.localeCompare(b.slug));
    } catch (e) {
      error.value = (e as Error).message;
    } finally {
      loading.value = false;
    }
  }

  async function remove(path: string) {
    await api.remove(path);
    await load();
  }

  return { items, loading, error, load, remove };
}
