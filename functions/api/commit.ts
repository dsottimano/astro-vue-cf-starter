/// <reference types="@cloudflare/workers-types" />
import type { Env } from './_env';
import { contentsUrl, ghHeaders, getSha, isUnsafePath, toBase64 } from './_github';

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

  let sha: string | undefined;
  try {
    sha = await getSha(env, path);
  } catch {
    return Response.json({ error: 'github read failed' }, { status: 502 });
  }

  const put = await fetch(contentsUrl(env, path), {
    method: 'PUT',
    headers: ghHeaders(env.GITHUB_TOKEN),
    body: JSON.stringify({
      message: message ?? `content: update ${path}`,
      content: toBase64(content),
      branch: env.GITHUB_BRANCH,
      sha,
    }),
  });

  if (!put.ok) {
    return Response.json({ error: 'github commit failed' }, { status: 502 });
  }

  const result = (await put.json()) as { commit: { sha: string } };
  return Response.json({ ok: true, commit: result.commit.sha });
};
