<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { route, navigate } from '../useRoute';
import { api } from '../api';
import { emptyPost, type PostFormModel } from '../model';
import { buildPostFile, parsePostFile } from '../serialize';
import { useCategories, categoryLabel } from '../useCategories';
import { siteConfig } from '../../../config/site.config';
import PostForm from '../PostForm.vue';

const isEdit = route.value.action === 'edit';
const model = ref<PostFormModel>(emptyPost(route.value.locale ?? siteConfig.defaultLocale));
const status = ref<{ kind: 'idle' | 'busy' | 'ok' | 'error'; message: string }>({
  kind: 'idle',
  message: '',
});

const { items: categories, load: loadCategories } = useCategories();
const categoryOptions = computed(() =>
  categories.value.map((c) => ({ slug: c.slug, label: categoryLabel(c) })),
);

onMounted(async () => {
  await loadCategories();
  if (isEdit && route.value.locale && route.value.slug) {
    status.value = { kind: 'busy', message: 'Loading…' };
    try {
      const path = `src/content/posts/${route.value.locale}/${route.value.slug}.md`;
      const { content } = await api.read(path);
      model.value = parsePostFile(content, route.value.locale);
      status.value = { kind: 'idle', message: '' };
    } catch (e) {
      status.value = { kind: 'error', message: (e as Error).message };
    }
  }
});

function upload(file: File, prefix: string) {
  return api.upload(file, prefix);
}

async function save() {
  if (!model.value.slug) {
    status.value = { kind: 'error', message: 'A title/slug is required.' };
    return;
  }
  if (!model.value.publishDate) {
    status.value = { kind: 'error', message: 'A publish date is required.' };
    return;
  }
  status.value = { kind: 'busy', message: 'Saving…' };
  const { path, content } = buildPostFile(model.value);
  try {
    const { commit } = await api.commit(path, content, `content: save ${path}`);
    status.value = { kind: 'ok', message: `Saved — commit ${commit.slice(0, 7)}.` };
  } catch (e) {
    status.value = { kind: 'error', message: (e as Error).message };
  }
}
</script>

<template>
  <section>
    <a class="back" href="#/posts">← Posts</a>
    <h1>{{ isEdit ? 'Edit post' : 'New post' }}</h1>
    <PostForm v-model="model" :categories="categoryOptions" :upload="upload" />
    <footer class="bar">
      <button type="button" class="secondary" @click="navigate('#/posts')">Cancel</button>
      <button type="button" class="primary" :disabled="status.kind === 'busy'" @click="save">
        Save
      </button>
      <span v-if="status.message" :class="['status', status.kind]">{{ status.message }}</span>
    </footer>
  </section>
</template>

<style scoped>
.back {
  display: inline-block;
  margin-bottom: 1rem;
  text-decoration: none;
}
.bar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 1.5rem;
}
button {
  font: inherit;
  padding: 0.5rem 1rem;
  border-radius: var(--radius);
  border: 1px solid var(--color-border);
  cursor: pointer;
}
.primary {
  background: var(--color-accent);
  color: #fff;
  border-color: transparent;
}
.secondary {
  background: var(--color-card);
  color: var(--color-fg);
}
.status.ok {
  color: #15803d;
}
.status.error {
  color: #b91c1c;
}
.status.busy {
  color: var(--color-muted);
}
</style>
