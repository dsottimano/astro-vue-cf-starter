import type { APIRoute } from 'astro';
import { siteConfig } from '../../config/site.config';

// Generated from siteConfig so the sitemap URL stays correct per deploy.
export const GET: APIRoute = () => {
  const body = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    '',
    `Sitemap: ${siteConfig.url}/sitemap-index.xml`,
    '',
  ].join('\n');

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
