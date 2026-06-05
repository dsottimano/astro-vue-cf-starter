<script setup lang="ts">
import { onMounted, ref } from 'vue';

// Persisted light/dark toggle. The no-flash script in BaseLayout sets the
// initial [data-theme] before paint; this just flips + stores the choice.
type Mode = 'light' | 'dark';
const mode = ref<Mode>('light');

function apply(next: Mode) {
  mode.value = next;
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
}

function toggle() {
  apply(mode.value === 'dark' ? 'light' : 'dark');
}

onMounted(() => {
  const current = document.documentElement.getAttribute('data-theme');
  mode.value =
    current === 'dark' || (!current && matchMedia('(prefers-color-scheme: dark)').matches)
      ? 'dark'
      : 'light';
});
</script>

<template>
  <button
    type="button"
    class="toggle"
    :aria-pressed="mode === 'dark'"
    aria-label="Toggle dark mode"
    @click="toggle"
  >
    {{ mode === 'dark' ? '☀️' : '🌙' }}
  </button>
</template>

<style scoped>
.toggle {
  font-size: 1.1rem;
  line-height: 1;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: 0.4rem 0.6rem;
  cursor: pointer;
}
</style>
