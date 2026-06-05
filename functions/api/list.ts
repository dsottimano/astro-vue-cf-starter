/// <reference types="@cloudflare/workers-types" />
import type { Env } from './_env';
import { isUnsafePath, listDir, type DirEntry } from './_github';

// GET /api/list?dir=src/content/posts/en
// Lists files in a content directory so the admin can show existing entries.

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const dir = new URL(request.url).searchParams.get('dir');
  if (!dir || isUnsafePath(dir)) {
    return Response.json({ error: 'invalid dir' }, { status: 400 });
  }

  let entries: DirEntry[];
  try {
    entries = await listDir(env, dir);
  } catch {
    return Response.json({ error: 'github list failed' }, { status: 502 });
  }
  return Response.json({ entries });
};
