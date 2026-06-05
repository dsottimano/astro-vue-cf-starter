/// <reference types="@cloudflare/workers-types" />
import type { Env } from './_env';

// Shared GitHub Contents API helpers used by commit / list / entry.

const GH = 'https://api.github.com';

export function ghHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'astro-vue-cf-starter',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

export function contentsUrl(env: Env, path: string): string {
  return `${GH}/repos/${env.GITHUB_REPO}/contents/${path}`;
}

// Reject paths that escape the repo tree.
export function isUnsafePath(path: string): boolean {
  return !path || path.includes('..') || path.startsWith('/');
}

// base64 of a UTF-8 string (btoa is latin1-only, so encode first).
export function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

// Decode GitHub's base64 (may contain newlines) back to a UTF-8 string.
export function fromBase64(b64: string): string {
  const bin = atob(b64.replace(/\n/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

// Current sha of a file, or undefined if it doesn't exist.
export async function getSha(env: Env, path: string): Promise<string | undefined> {
  const res = await fetch(`${contentsUrl(env, path)}?ref=${env.GITHUB_BRANCH}`, {
    headers: ghHeaders(env.GITHUB_TOKEN),
  });
  if (res.ok) return ((await res.json()) as { sha: string }).sha;
  if (res.status === 404) return undefined;
  throw new Error(`github read failed (${res.status})`);
}
