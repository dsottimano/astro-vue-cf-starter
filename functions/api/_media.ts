/// <reference types="@cloudflare/workers-types" />
import type { Env } from './_env';

// Shared R2 media helpers used by /api/upload and the Telegram bot.

export const ALLOWED = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'application/pdf',
]);
export const MAX_BYTES = 15 * 1024 * 1024; // 15 MB

// "photos/<rand>-<name>.jpg" — collision-resistant.
export function buildKey(prefix: string, filename: string): string {
  const safe =
    filename
      .toLowerCase()
      .replace(/[^a-z0-9.]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'file';
  const rand = crypto.randomUUID().slice(0, 8);
  const clean = prefix.replace(/[^a-z0-9/_-]/gi, '').replace(/^\/+|\/+$/g, '') || 'uploads';
  return `${clean}/${rand}-${safe}`;
}

// Put a binary to R2 under an already-built key.
export async function putMedia(
  env: Env,
  body: ReadableStream | ArrayBuffer | Uint8Array,
  contentType: string,
  key: string,
): Promise<void> {
  await env.MEDIA.put(key, body, { httpMetadata: { contentType } });
}
