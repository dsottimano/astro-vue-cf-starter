import { describe, it, expect } from 'vitest';
import { onRequestPost } from './commit';
import type { Env } from './_env';

const env = {
  GITHUB_REPO: 'owner/repo',
  GITHUB_BRANCH: 'main',
  GITHUB_TOKEN: 'token',
} as Env;

// Only the parsing/validation branches are exercised — they return before any
// network call to GitHub.
function call(body: BodyInit | null, contentType = 'application/json') {
  const request = new Request('https://x/api/commit', {
    method: 'POST',
    headers: { 'Content-Type': contentType },
    body,
  });
  return onRequestPost({ request, env } as never);
}

describe('POST /api/commit validation', () => {
  it('rejects invalid JSON', async () => {
    const res = await call('not json{');
    expect(res.status).toBe(400);
  });

  it('rejects missing path/content', async () => {
    const res = await call(JSON.stringify({ content: 'x' }));
    expect(res.status).toBe(400);
  });

  it('rejects path traversal', async () => {
    const res = await call(JSON.stringify({ path: '../../etc/passwd', content: 'x' }));
    expect(res.status).toBe(400);
  });

  it('rejects absolute paths', async () => {
    const res = await call(JSON.stringify({ path: '/abs', content: 'x' }));
    expect(res.status).toBe(400);
  });
});
