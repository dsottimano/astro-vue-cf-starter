<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useCategories, categoryLabel } from '../useCategories';
import { emptyCategory, slugify, type CategoryFormModel } from '../model';
import { siteConfig } from '../../../config/site.config';

const { items, loading, error, load, save, remove } = useCategories();
const locales = siteConfig.locales;

const draft = ref<CategoryFormModel>(emptyCategory(locales));
const editing = ref(false); // editing existing (slug locked) vs new
const status = ref<{ kind: 'idle' | 'ok' | 'error'; message: string }>({
  kind: 'idle',
  message: '',
});

onMounted(load);

let slugTouched = false;
function onPrimaryName(e: Event) {
  const v = (e.target as HTMLInputElement).value;
  draft.value.name[siteConfig.defaultLocale] = v;
  if (!editing.value && !slugTouched) draft.value.slug = slugify(v);
}

function newCategory() {
  draft.value = emptyCategory(locales);
  editing.value = false;
  slugTouched = false;
  status.value = { kind: 'idle', message: '' };
}

function editCategory(cat: CategoryFormModel) {
  draft.value = { slug: cat.slug, parent: cat.parent, name: { ...cat.name } };
  editing.value = true;
  status.value = { kind: 'idle', message: '' };
}

async function onSave() {
  if (!draft.value.slug) {
    status.value = { kind: 'error', message: 'A name/slug is required.' };
    return;
  }
  try {
    await save(draft.value);
    status.value = { kind: 'ok', message: `Saved “${draft.value.slug}”.` };
    newCategory();
  } catch (e) {
    status.value = { kind: 'error', message: (e as Error).message };
  }
}

async function onRemove(cat: CategoryFormModel & { path: string }) {
  if (confirm(`Delete category “${cat.slug}”?`)) await remove(cat.path);
}
</script>

<template>
  <section class="layout">
    <div>
      <h1>Categories</h1>
      <p v-if="error" class="err">{{ error }}</p>
      <p v-if="loading" class="muted">Loading…</p>
      <table v-else class="list">
        <thead>
          <tr>
            <th>Name</th>
            <th>Slug</th>
            <th>Parent</th>
            <th class="actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="cat in items" :key="cat.path">
            <td>{{ categoryLabel(cat) }}</td>
            <td>
              <code>{{ cat.slug }}</code>
            </td>
            <td class="muted">{{ cat.parent || '—' }}</td>
            <td class="actions">
              <button type="button" @click="editCategory(cat)">Edit</button>
              <button type="button" class="danger" @click="onRemove(cat)">Delete</button>
            </td>
          </tr>
          <tr v-if="items.length === 0">
            <td colspan="4" class="empty">No categories yet.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <aside class="panel">
      <header class="panel-head">
        <h2>{{ editing ? 'Edit category' : 'New category' }}</h2>
        <button v-if="editing" type="button" class="link" @click="newCategory">+ New</button>
      </header>

      <label v-for="loc in locales" :key="loc">
        Name ({{ loc }})
        <input
          v-if="loc === siteConfig.defaultLocale"
          :value="draft.name[loc]"
          type="text"
          @input="onPrimaryName"
        />
        <input v-else v-model="draft.name[loc]" type="text" />
      </label>

      <label>
        Slug
        <input v-model="draft.slug" type="text" :disabled="editing" @input="slugTouched = true" />
      </label>

      <label>
        Parent
        <select v-model="draft.parent">
          <option value="">— None —</option>
          <option
            v-for="cat in items.filter((c) => c.slug !== draft.slug)"
            :key="cat.slug"
            :value="cat.slug"
          >
            {{ categoryLabel(cat) }}
          </option>
        </select>
      </label>

      <button type="button" class="primary" @click="onSave">Save category</button>
      <p v-if="status.message" :class="['status', status.kind]">{{ status.message }}</p>
    </aside>
  </section>
</template>

<style scoped>
.layout {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 2rem;
  align-items: start;
}
.list {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.92rem;
}
.list th,
.list td {
  text-align: left;
  padding: 0.55rem 0.6rem;
  border-bottom: 1px solid var(--color-border);
}
.list thead th {
  font-size: 0.78rem;
  text-transform: uppercase;
  color: var(--color-muted);
}
.actions {
  text-align: right;
  white-space: nowrap;
}
.actions button {
  font: inherit;
  font-size: 0.85rem;
  padding: 0.3rem 0.6rem;
  margin-left: 0.4rem;
  border: 1px solid var(--color-border);
  border-radius: 0.3rem;
  background: var(--color-bg);
  cursor: pointer;
}
.danger {
  color: #b91c1c;
}
.panel {
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: 1rem;
  background: var(--color-card);
}
.panel-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.panel-head h2 {
  font-size: 1rem;
  margin: 0 0 0.5rem;
}
.link {
  background: none;
  border: none;
  color: var(--color-accent);
  cursor: pointer;
  font: inherit;
}
.panel label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.85rem;
  margin-bottom: 0.6rem;
}
.panel input,
.panel select {
  font: inherit;
  padding: 0.4rem;
  border: 1px solid var(--color-border);
  border-radius: 0.3rem;
  background: var(--color-bg);
  color: var(--color-fg);
}
.primary {
  font: inherit;
  width: 100%;
  padding: 0.5rem;
  margin-top: 0.5rem;
  border: none;
  border-radius: var(--radius);
  background: var(--color-accent);
  color: #fff;
  cursor: pointer;
}
.muted {
  color: var(--color-muted);
}
.err {
  color: #b91c1c;
}
.empty {
  text-align: center;
  color: var(--color-muted);
  padding: 1.5rem;
}
.status.ok {
  color: #15803d;
}
.status.error {
  color: #b91c1c;
}
@media (max-width: 720px) {
  .layout {
    grid-template-columns: 1fr;
  }
}
</style>
