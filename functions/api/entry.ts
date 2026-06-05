/// <reference types="@cloudflare/workers-types" />
import type { Env } from './_env';
import { contentsUrl, ghHeaders, getSha, isUnsafePath, readFile } from './_github';

// GET    /api/entry?path=...  → read one file { content, sha }
// DELETE /api/entry?path=...  → remove one file (commits a deletion)

function pathParam(request: Request): string | null {
  const path = new URL(request.url).searchParams.get('path');
  return path && !isUnsafePath(path) ? path : null;
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const path = pathParam(request);
  if (!path) return Response.json({ error: 'invalid path' }, { status: 400 });

  let file: { content: string; sha: string } | null;
  try {
    file = await readFile(env, path);
  } catch {
    return Response.json({ error: 'github read failed' }, { status: 502 });
  }
  if (!file) return Response.json({ error: 'not found' }, { status: 404 });
  return Response.json({ content: file.content, sha: file.sha });
};

export const onRequestDelete: PagesFunction<Env> = async ({ request, env }) => {
  const path = pathParam(request);
  if (!path) return Response.json({ error: 'invalid path' }, { status: 400 });

  let sha: string | undefined;
  try {
    sha = await getSha(env, path);
  } catch {
    return Response.json({ error: 'github read failed' }, { status: 502 });
  }
  if (!sha) return Response.json({ error: 'not found' }, { status: 404 });

  const res = await fetch(contentsUrl(env, path), {
    method: 'DELETE',
    headers: ghHeaders(env.GITHUB_TOKEN),
    body: JSON.stringify({ message: `content: delete ${path}`, sha, branch: env.GITHUB_BRANCH }),
  });
  if (!res.ok) return Response.json({ error: 'github delete failed' }, { status: 502 });

  return Response.json({ ok: true });
};
