// @ts-check
import { defineConfig } from 'astro/config';
import vue from '@astrojs/vue';
import sitemap from '@astrojs/sitemap';
import icon from 'astro-icon';
import compress from '@playform/compress';
import tailwindcss from '@tailwindcss/vite';

import { siteConfig } from './config/site.config.ts';
import { emitRedirects } from './integrations/emit-redirects.ts';

export default defineConfig({
  // Static-first: Astro builds to dist/, served by Cloudflare Pages.
  output: 'static',

  // Absolute base for sitemap / canonical / OG URLs.
  site: siteConfig.url,

  // Built-in i18n: locale-prefixed routes (/en/..., /es/...).
  i18n: {
    defaultLocale: siteConfig.defaultLocale,
    locales: [...siteConfig.locales],
    routing: {
      prefixDefaultLocale: true, // every locale is prefixed; "/" redirects below
    },
  },

  // Redirects (incl. root → default locale) are compiled to dist/_redirects
  // from config/redirects.config.ts by the emitRedirects integration below.

  integrations: [
    vue(), // mounts <AdminApp client:only="vue"> and ThemeToggle.vue
    icon(), // astro-icon: build-time SVG icons
    sitemap({
      i18n: {
        defaultLocale: siteConfig.defaultLocale,
        locales: Object.fromEntries(siteConfig.locales.map((l) => [l, l])),
      },
    }),
    // Minify JS/CSS/SVG. HTML minification is left off so html-validate runs
    // against faithful markup (Cloudflare gzips HTML on the wire regardless).
    compress({ HTML: false }),
    emitRedirects(), // config/redirects.config.ts → dist/_redirects
  ],

  vite: {
    plugins: [tailwindcss()],
  },

  // BLANK (Open Detail #1): Cloudflare adapter goes here IF we move to SSR/hybrid
  // for Pages Functions dev wiring. Pure-static + `wrangler pages dev` needs no
  // adapter. Decide before wiring /api/commit + /api/upload.
  // adapter: cloudflare(),
});
