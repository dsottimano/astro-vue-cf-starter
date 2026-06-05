<script setup lang="ts">
const cards = [
  { href: '#/listings', title: 'Listings', desc: 'Properties for sale or rent.' },
  { href: '#/posts', title: 'Posts', desc: 'Blog articles and news.' },
  { href: '#/categories', title: 'Categories', desc: 'Organize posts into a taxonomy.' },
  { href: '#/redirects', title: 'Redirects', desc: 'Manage URL redirects.' },
];

// Editor how-to wiki (lives in the repo, rendered on GitHub). External link.
const helpUrl = 'https://github.com/dsottimano/astro-vue-cf-starter/tree/main/docs/admin-wiki';
</script>

<template>
  <section>
    <h1>Dashboard</h1>
    <p class="muted">Manage your content. Pick a section to get started.</p>
    <div class="cards">
      <a v-for="c in cards" :key="c.href" :href="c.href" class="card">
        <h2>{{ c.title }}</h2>
        <p>{{ c.desc }}</p>
      </a>
      <a :href="helpUrl" class="card help" target="_blank" rel="noopener">
        <h2>Help &amp; guides ↗</h2>
        <p>How-to wiki for content editors.</p>
      </a>
    </div>
  </section>
</template>

<style scoped>
.muted {
  color: var(--color-muted);
}
.cards {
  margin-top: 1.5rem;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 1rem;
}
.card {
  display: block;
  padding: 1.25rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-card);
  text-decoration: none;
  color: var(--color-fg);
}
.card h2 {
  margin: 0 0 0.4rem;
  font-size: 1.05rem;
}
.card p {
  margin: 0;
  color: var(--color-muted);
  font-size: 0.9rem;
}
</style>
