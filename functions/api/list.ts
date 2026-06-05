/// <reference types="@cloudflare/workers-types" />
import type { Env } from './_env';
import { contentsUrl, ghHeaders, isUnsafePath } from './_github';

// GET /api/list?dir=src/content/posts/en
// Lists files in a content directory so the admin can show existing entries.

interface GhEntry {
  name: string;
  path: string;
  sha: string;
  type: 'file' | 'dir';
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const dir = new URL(request.url).searchParams.get('dir');
  if (!dir || isUnsafePath(dir)) {
    return Response.json({ error: 'invalid dir' }, { status: 400 });
  }

  const res = await fetch(`${contentsUrl(env, dir)}?ref=${env.GITHUB_BRANCH}`, {
    headers: ghHeaders(env.GITHUB_TOKEN),
  });

  // Empty/missing directory → empty list (not an error for the admin).
  if (res.status === 404) return Response.json({ entries: [] });
  if (!res.ok) return Response.json({ error: 'github list failed' }, { status: 502 });

  const data = (await res.json()) as GhEntry[] | GhEntry;
  const arr = Array.isArray(data) ? data : [data];
  const entries = arr
    .filter((e) => e.type === 'file')
    .map((e) => ({ name: e.name, path: e.path, sha: e.sha }));

  return Response.json({ entries });
};
