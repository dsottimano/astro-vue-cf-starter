import { ref, computed } from 'vue';

// Minimal hash router for the admin island — no dependency, no app plugin.
// Routes: #/, #/listings, #/listings/new, #/listings/edit/<locale>/<slug>,
//         #/posts(...), #/categories, #/redirects

export interface AdminRoute {
  section: 'dashboard' | 'listings' | 'posts' | 'categories' | 'redirects';
  action: 'list' | 'new' | 'edit';
  locale?: string;
  slug?: string;
}

const SECTIONS = ['dashboard', 'listings', 'posts', 'categories', 'redirects'] as const;

function parse(hash: string): AdminRoute {
  const seg = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const section = (SECTIONS as readonly string[]).includes(seg[0])
    ? (seg[0] as AdminRoute['section'])
    : 'dashboard';
  const action = (seg[1] === 'new' || seg[1] === 'edit' ? seg[1] : 'list') as AdminRoute['action'];
  return { section, action, locale: seg[2], slug: seg.slice(3).join('/') || undefined };
}

const current = ref('');
if (typeof window !== 'undefined') {
  current.value = window.location.hash;
  window.addEventListener('hashchange', () => {
    current.value = window.location.hash;
  });
}

export const route = computed(() => parse(current.value));

export function navigate(to: string): void {
  if (typeof window !== 'undefined') window.location.hash = to;
}
