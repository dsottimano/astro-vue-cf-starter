import { siteConfig } from '../../config/site.config';

/** Build a public R2 URL from a stored object key. */
export function imageUrl(key: string): string {
  return `${siteConfig.r2PublicBase}/${key}`;
}
