// Edge redirects, compiled to Cloudflare `dist/_redirects` at build time
// (see integrations/emit-redirects.ts). The source of truth is redirects.json
// so the admin can round-trip it; status defaults to 301.
import rules from './redirects.json';

export interface RedirectRule {
  source: string;
  destination: string;
  status?: number;
}

export const redirects: RedirectRule[] = rules as RedirectRule[];
