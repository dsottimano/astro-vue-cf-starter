/// <reference types="@cloudflare/workers-types" />
import type { Env } from './_env';
import { isUnsafePath, commitFile } from './_github';

// POST { path, content, message? }
// Commits a text file to the content repo via the GitHub Contents API.
// Push triggers a Cloudflare Pages rebuild. Content-agnostic.

interface CommitBody {
  path: string;
  content: string;
  message?: string;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: CommitBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'invalid JSON' }, { status: 400 });
  }

  const { path, content, message } = body;
  if (typeof path !== 'string' || !path || typeof content !== 'string') {
    return Response.json({ error: 'path and content are required' }, { status: 400 });
  }
  if (isUnsafePath(path)) {
    return Response.json({ error: 'invalid path' }, { status: 400 });
  }

  try {
    const commit = await commitFile(env, path, content, message ?? `content: update ${path}`);
    return Response.json({ ok: true, commit });
  } catch {
    return Response.json({ error: 'github commit failed' }, { status: 502 });
  }
};
