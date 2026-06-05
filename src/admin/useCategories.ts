import { ref } from 'vue';
import { api } from './api';
import { buildCategoryFile, parseCategoryFile } from './serialize';
import type { CategoryFormModel } from './model';
import { siteConfig } from '../../config/site.config';

export interface CategoryRecord extends CategoryFormModel {
  path: string;
}

export function useCategories() {
  const items = ref<CategoryRecord[]>([]);
  const loading = ref(false);
  const error = ref('');

  async function load() {
    loading.value = true;
    error.value = '';
    try {
      const entries = await api.list('src/content/categories');
      const recs: CategoryRecord[] = [];
      for (const e of entries) {
        const { content } = await api.read(e.path);
        recs.push({ ...parseCategoryFile(content), path: e.path });
      }
      items.value = recs.sort((a, b) => a.slug.localeCompare(b.slug));
    } catch (e) {
      error.value = (e as Error).message;
    } finally {
      loading.value = false;
    }
  }

  async function save(cat: CategoryFormModel) {
    const { path, content } = buildCategoryFile(cat);
    await api.commit(path, content, `content: save category ${cat.slug}`);
    await load();
  }

  async function remove(path: string) {
    await api.remove(path);
    await load();
  }

  return { items, loading, error, load, save, remove };
}

/** Default-locale label for a category, for pickers. */
export function categoryLabel(cat: CategoryFormModel): string {
  return cat.name[siteConfig.defaultLocale] || cat.slug;
}
