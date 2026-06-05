import { writeFileSync } from 'node:fs';
import type { AstroIntegration } from 'astro';
import { redirects, type RedirectRule } from '../config/redirects.config';

// Writes config/redirects.config.ts → dist/_redirects (Cloudflare format).
export function emitRedirects(rules: RedirectRule[] = redirects): AstroIntegration {
  return {
    name: 'emit-redirects',
    hooks: {
      'astro:build:done': ({ dir }) => {
        const lines = rules.map((r) => `${r.source} ${r.destination} ${r.status ?? 301}`);
        writeFileSync(new URL('_redirects', dir), lines.join('\n') + '\n');
      },
    },
  };
}
