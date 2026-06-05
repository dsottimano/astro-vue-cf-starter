<script setup lang="ts">
import { route } from '../useRoute';

const nav = [
  { section: 'dashboard', href: '#/', label: 'Dashboard', icon: '▦' },
  { section: 'listings', href: '#/listings', label: 'Listings', icon: '🏠' },
  { section: 'posts', href: '#/posts', label: 'Posts', icon: '📝' },
  { section: 'categories', href: '#/categories', label: 'Categories', icon: '🏷' },
  { section: 'redirects', href: '#/redirects', label: 'Redirects', icon: '↪' },
] as const;
</script>

<template>
  <div class="wp">
    <aside class="sidebar">
      <div class="brand">Admin</div>
      <nav>
        <a
          v-for="item in nav"
          :key="item.section"
          :href="item.href"
          :class="{ active: route.section === item.section }"
        >
          <span class="ico" aria-hidden="true">{{ item.icon }}</span
          >{{ item.label }}
        </a>
      </nav>
      <a class="view-site" href="/" target="_blank" rel="noopener">View site ↗</a>
    </aside>
    <main class="content">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.wp {
  display: grid;
  grid-template-columns: 220px 1fr;
  min-height: 100vh;
}
.sidebar {
  background: var(--color-card);
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  padding: 1rem 0;
}
.brand {
  font-weight: 700;
  padding: 0.5rem 1.25rem 1rem;
  font-size: 1.1rem;
}
.sidebar nav {
  display: flex;
  flex-direction: column;
}
.sidebar nav a {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.6rem 1.25rem;
  color: var(--color-fg);
  text-decoration: none;
  border-left: 3px solid transparent;
  font-size: 0.92rem;
}
.sidebar nav a:hover {
  background: var(--color-bg);
}
.sidebar nav a.active {
  border-left-color: var(--color-accent);
  background: var(--color-bg);
  font-weight: 600;
}
.ico {
  width: 1.2rem;
  text-align: center;
}
.view-site {
  margin-top: auto;
  padding: 1rem 1.25rem 0;
  font-size: 0.85rem;
  color: var(--color-muted);
  text-decoration: none;
}
.content {
  padding: 2rem;
  min-width: 0;
}
@media (max-width: 640px) {
  .wp {
    grid-template-columns: 1fr;
  }
  .sidebar {
    flex-direction: row;
    overflow-x: auto;
    align-items: center;
  }
  .view-site {
    margin: 0;
    padding: 0 1rem;
  }
}
</style>
