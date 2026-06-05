import { describe, it, expect } from 'vitest';
import { onRequestGet } from './list';
import type { Env } from './_env';

const env = { GITHUB_REPO: 'o/r', GITHUB_BRANCH: 'main', GITHUB_TOKEN: 't' } as Env;

const call = (url: string) => onRequestGet({ request: new Request(url), env } as never);

describe('GET /api/list validation', () => {
  it('rejects a missing dir', async () => {
    expect((await call('https://x/api/list')).status).toBe(400);
  });

  it('rejects path traversal in dir', async () => {
    expect((await call('https://x/api/list?dir=../../etc')).status).toBe(400);
  });
});
