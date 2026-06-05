<script setup lang="ts" generic="T">
// Reusable WordPress-style list table. Columns are described by the caller;
// each renders via the #cell slot. Edit/Delete actions are emitted up.
defineProps<{
  columns: { key: string; label: string }[];
  rows: T[];
  rowKey: (row: T) => string;
}>();

defineEmits<{ edit: [row: T]; remove: [row: T] }>();

defineSlots<{ cell(props: { row: T; key: string }): unknown }>();
</script>

<template>
  <table class="list">
    <thead>
      <tr>
        <th v-for="c in columns" :key="c.key">{{ c.label }}</th>
        <th class="actions">Actions</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="row in rows" :key="rowKey(row)">
        <td v-for="c in columns" :key="c.key">
          <slot name="cell" :row="row" :key="c.key" />
        </td>
        <td class="actions">
          <button type="button" @click="$emit('edit', row)">Edit</button>
          <button type="button" class="danger" @click="$emit('remove', row)">Delete</button>
        </td>
      </tr>
      <tr v-if="rows.length === 0">
        <td :colspan="columns.length + 1" class="empty">No entries yet.</td>
      </tr>
    </tbody>
  </table>
</template>

<style scoped>
.list {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.92rem;
}
.list th,
.list td {
  text-align: left;
  padding: 0.6rem 0.75rem;
  border-bottom: 1px solid var(--color-border);
}
.list thead th {
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
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
  color: var(--color-fg);
  cursor: pointer;
}
.actions .danger {
  color: #b91c1c;
}
.empty {
  color: var(--color-muted);
  text-align: center;
  padding: 2rem;
}
</style>
