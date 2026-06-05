<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { route, navigate } from '../useRoute';
import { api } from '../api';
import { emptyListing, type ListingFormModel } from '../model';
import { buildListingFile, parseListingFile } from '../serialize';
import { siteConfig } from '../../../config/site.config';
import ListingForm from '../ListingForm.vue';

const isEdit = route.value.action === 'edit';
const model = ref<ListingFormModel>(emptyListing(route.value.locale ?? siteConfig.defaultLocale));
const status = ref<{ kind: 'idle' | 'busy' | 'ok' | 'error'; message: string }>({
  kind: 'idle',
  message: '',
});

onMounted(async () => {
  if (isEdit && route.value.locale && route.value.slug) {
    status.value = { kind: 'busy', message: 'Loading…' };
    try {
      const path = `src/content/listings/${route.value.locale}/${route.value.slug}.md`;
      const { content } = await api.read(path);
      model.value = parseListingFile(content, route.value.locale);
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
  status.value = { kind: 'busy', message: 'Saving…' };
  const { path, content } = buildListingFile(model.value);
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
    <a class="back" href="#/listings">← Listings</a>
    <h1>{{ isEdit ? 'Edit listing' : 'New listing' }}</h1>
    <ListingForm v-model="model" :upload="upload" />
    <footer class="bar">
      <button type="button" class="secondary" @click="navigate('#/listings')">Cancel</button>
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
