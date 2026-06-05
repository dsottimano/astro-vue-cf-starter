<script setup lang="ts">
import { onMounted } from 'vue';
import { useCollection, type CollectionItem } from '../useCollection';
import { navigate } from '../useRoute';
import ListTable from '../components/ListTable.vue';

const { items, loading, error, load, remove } = useCollection('listings');
onMounted(load);

function edit(row: CollectionItem) {
  navigate(`#/listings/edit/${row.locale}/${row.slug}`);
}
async function onRemove(row: CollectionItem) {
  if (confirm(`Delete listing ${row.locale}/${row.slug}?`)) await remove(row.path);
}

const columns = [
  { key: 'slug', label: 'Slug' },
  { key: 'locale', label: 'Locale' },
];
</script>

<template>
  <section>
    <header class="head">
      <h1>Listings</h1>
      <a class="btn" href="#/listings/new">Add new</a>
    </header>
    <p v-if="error" class="err">{{ error }}</p>
    <p v-if="loading" class="muted">Loading…</p>
    <ListTable
      v-else
      :columns="columns"
      :rows="items"
      :row-key="(r) => r.path"
      @edit="edit"
      @remove="onRemove"
    >
      <template #cell="{ row, key }">
        <span v-if="key === 'locale'" class="badge">{{ row.locale }}</span>
        <span v-else>{{ row.slug }}</span>
      </template>
    </ListTable>
  </section>
</template>

<style scoped>
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.btn {
  background: var(--color-accent);
  color: #fff;
  padding: 0.5rem 1rem;
  border-radius: var(--radius);
  text-decoration: none;
  font-size: 0.9rem;
}
.muted {
  color: var(--color-muted);
}
.err {
  color: #b91c1c;
}
.badge {
  font-size: 0.75rem;
  padding: 0.15rem 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 999px;
}
</style>
