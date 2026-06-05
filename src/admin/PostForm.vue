<script setup lang="ts">
import { watch } from 'vue';
import type { PostFormModel } from './model';
import { slugify } from './model';

// Explicit blog-post form (Approach B). Mirrors the posts schema in
// src/content.config.ts. Cover-image upload delegates to AdminApp.

const model = defineModel<PostFormModel>({ required: true });

const props = defineProps<{
  categories: { slug: string; label: string }[];
  upload: (file: File, prefix: string) => Promise<string>;
}>();

let slugTouched = false;
watch(
  () => model.value.title,
  (title) => {
    if (!slugTouched) {
      const s = slugify(title);
      model.value.slug = s;
      if (!model.value.translationKey) model.value.translationKey = s;
    }
  },
);

function toggleCategory(slug: string, checked: boolean) {
  const set = new Set(model.value.categories);
  if (checked) set.add(slug);
  else set.delete(slug);
  model.value.categories = [...set];
}

async function onCover(e: Event) {
  const input = e.target as HTMLInputElement;
  if (!input.files?.[0]) return;
  model.value.coverImage = await props.upload(input.files[0], 'posts');
  input.value = '';
}
</script>

<template>
  <div class="form">
    <fieldset>
      <legend>Basics</legend>
      <label>Title<input v-model="model.title" type="text" /></label>
      <label>Slug<input v-model="model.slug" type="text" @input="slugTouched = true" /> </label>
      <label>Translation key<input v-model="model.translationKey" type="text" /></label>
      <div class="row">
        <label
          >Status
          <select v-model="model.status">
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </label>
        <label>Publish date<input v-model="model.publishDate" type="date" /></label>
      </div>
    </fieldset>

    <fieldset>
      <legend>Categories</legend>
      <p v-if="categories.length === 0" class="hint">
        No categories yet — create some under Categories.
      </p>
      <label v-for="c in categories" :key="c.slug" class="check">
        <input
          type="checkbox"
          :checked="model.categories.includes(c.slug)"
          @change="toggleCategory(c.slug, ($event.target as HTMLInputElement).checked)"
        />
        {{ c.label }}
      </label>
    </fieldset>

    <fieldset>
      <legend>Cover image</legend>
      <p v-if="model.coverImage" class="key">
        <code>{{ model.coverImage }}</code>
        <button type="button" @click="model.coverImage = ''">✕</button>
      </p>
      <input type="file" accept="image/*" @change="onCover" />
    </fieldset>

    <fieldset>
      <legend>Excerpt</legend>
      <textarea v-model="model.excerpt" rows="2"></textarea>
    </fieldset>

    <fieldset>
      <legend>Body (markdown)</legend>
      <textarea v-model="model.body" rows="12"></textarea>
    </fieldset>
  </div>
</template>

<style scoped>
.form {
  display: grid;
  gap: 1.25rem;
}
fieldset {
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: 1rem;
}
legend {
  font-weight: 600;
  padding: 0 0.4rem;
}
label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.85rem;
  margin-bottom: 0.5rem;
}
.row {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}
.row > label {
  flex: 1;
  min-width: 10rem;
}
.check {
  flex-direction: row;
  align-items: center;
  gap: 0.4rem;
}
.hint {
  color: var(--color-muted);
  font-size: 0.85rem;
  margin: 0;
}
.key {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin: 0 0 0.5rem;
}
input,
select,
textarea {
  font: inherit;
  padding: 0.4rem;
  border: 1px solid var(--color-border);
  border-radius: 0.3rem;
  background: var(--color-bg);
  color: var(--color-fg);
}
</style>
