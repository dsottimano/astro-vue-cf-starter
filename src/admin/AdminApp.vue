<script setup lang="ts">
import { computed } from 'vue';
import { route } from './useRoute';
import AdminLayout from './components/AdminLayout.vue';
import Dashboard from './views/Dashboard.vue';
import ListingsList from './views/ListingsList.vue';
import ListingEdit from './views/ListingEdit.vue';
import PostsList from './views/PostsList.vue';
import PostEdit from './views/PostEdit.vue';
import Categories from './views/Categories.vue';
import Redirects from './views/Redirects.vue';

// Switch the active view from the hash route. The :key remounts edit screens
// when the target entry changes, so each load fetches fresh data.
const view = computed(() => {
  const r = route.value;
  switch (r.section) {
    case 'listings':
      return r.action === 'list' ? ListingsList : ListingEdit;
    case 'posts':
      return r.action === 'list' ? PostsList : PostEdit;
    case 'categories':
      return Categories;
    case 'redirects':
      return Redirects;
    default:
      return Dashboard;
  }
});

const viewKey = computed(() => {
  const r = route.value;
  return `${r.section}/${r.action}/${r.locale ?? ''}/${r.slug ?? ''}`;
});
</script>

<template>
  <AdminLayout>
    <component :is="view" :key="viewKey" />
  </AdminLayout>
</template>
