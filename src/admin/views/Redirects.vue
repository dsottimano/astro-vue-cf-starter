<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from '../api';

interface Rule {
  source: string;
  destination: string;
  status: number;
}

const PATH = 'config/redirects.json';
const rows = ref<Rule[]>([]);
const loading = ref(false);
const status = ref<{ kind: 'idle' | 'busy' | 'ok' | 'error'; message: string }>({
  kind: 'idle',
  message: '',
});

onMounted(load);

async function load() {
  loading.value = true;
  status.value = { kind: 'idle', message: '' };
  try {
    const { content } = await api.read(PATH);
    const parsed = JSON.parse(content) as Rule[];
    rows.value = parsed.map((r) => ({ status: 301, ...r }));
  } catch (e) {
    status.value = { kind: 'error', message: (e as Error).message };
  } finally {
    loading.value = false;
  }
}

function addRow() {
  rows.value.push({ source: '', destination: '', status: 301 });
}
function removeRow(i: number) {
  rows.value.splice(i, 1);
}

async function save() {
  const clean = rows.value.filter((r) => r.source && r.destination);
  status.value = { kind: 'busy', message: 'Saving…' };
  try {
    const content = JSON.stringify(clean, null, 2) + '\n';
    const { commit } = await api.commit(PATH, content, 'content: update redirects');
    status.value = { kind: 'ok', message: `Saved — commit ${commit.slice(0, 7)}.` };
  } catch (e) {
    status.value = { kind: 'error', message: (e as Error).message };
  }
}
</script>

<template>
  <section>
    <header class="head">
      <h1>Redirects</h1>
      <button type="button" class="btn" @click="addRow">Add row</button>
    </header>
    <p class="muted">
      Compiled to Cloudflare <code>_redirects</code> on the next build. Status defaults to 301.
    </p>

    <p v-if="loading" class="muted">Loading…</p>
    <table v-else class="list">
      <thead>
        <tr>
          <th>Source</th>
          <th>Destination</th>
          <th>Status</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, i) in rows" :key="i">
          <td><input v-model="row.source" type="text" placeholder="/old" /></td>
          <td><input v-model="row.destination" type="text" placeholder="/new" /></td>
          <td class="status-col">
            <select v-model.number="row.status">
              <option :value="301">301</option>
              <option :value="302">302</option>
              <option :value="307">307</option>
              <option :value="308">308</option>
            </select>
          </td>
          <td><button type="button" class="danger" @click="removeRow(i)">✕</button></td>
        </tr>
        <tr v-if="rows.length === 0">
          <td colspan="4" class="empty">No redirects.</td>
        </tr>
      </tbody>
    </table>

    <footer class="bar">
      <button type="button" class="primary" :disabled="status.kind === 'busy'" @click="save">
        Save redirects
      </button>
      <span v-if="status.message" :class="['status', status.kind]">{{ status.message }}</span>
    </footer>
  </section>
</template>

<style scoped>
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.muted {
  color: var(--color-muted);
  font-size: 0.9rem;
}
.list {
  width: 100%;
  border-collapse: collapse;
  margin-top: 1rem;
}
.list th,
.list td {
  text-align: left;
  padding: 0.4rem 0.5rem;
  border-bottom: 1px solid var(--color-border);
}
.list th {
  font-size: 0.78rem;
  text-transform: uppercase;
  color: var(--color-muted);
}
.list input,
.list select {
  font: inherit;
  width: 100%;
  padding: 0.35rem;
  border: 1px solid var(--color-border);
  border-radius: 0.3rem;
  background: var(--color-bg);
  color: var(--color-fg);
}
.status-col {
  width: 6rem;
}
.danger {
  background: none;
  border: none;
  color: #b91c1c;
  cursor: pointer;
  font: inherit;
}
.btn {
  font: inherit;
  padding: 0.45rem 0.9rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-bg);
  cursor: pointer;
}
.bar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 1.5rem;
}
.primary {
  font: inherit;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: var(--radius);
  background: var(--color-accent);
  color: #fff;
  cursor: pointer;
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
.empty {
  text-align: center;
  color: var(--color-muted);
  padding: 1.5rem;
}
</style>
