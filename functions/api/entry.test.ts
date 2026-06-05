import { describe, it, expect } from 'vitest';
import { onRequestGet, onRequestDelete } from './entry';
import type { Env } from './_env';

const env = { GITHUB_REPO: 'o/r', GITHUB_BRANCH: 'main', GITHUB_TOKEN: 't' } as Env;

const get = (url: string) => onRequestGet({ request: new Request(url), env } as never);
const del = (url: string) =>
  onRequestDelete({ request: new Request(url, { method: 'DELETE' }), env } as never);

describe('/api/entry validation', () => {
  it('GET rejects a missing path', async () => {
    expect((await get('https://x/api/entry')).status).toBe(400);
  });

  it('GET rejects path traversal', async () => {
    expect((await get('https://x/api/entry?path=../secret')).status).toBe(400);
  });

  it('DELETE rejects a missing path', async () => {
    expect((await del('https://x/api/entry')).status).toBe(400);
  });
});
