import { describe, it, expect, vi, afterEach } from 'vitest';
import { commitFile, readFile, listDir } from './_github';
import type { Env } from './_env';

const env = { GITHUB_REPO: 'o/r', GITHUB_BRANCH: 'main', GITHUB_TOKEN: 't' } as Env;

afterEach(() => vi.restoreAllMocks());

function mockFetch(...responses: Response[]) {
  const fn = vi.fn();
  responses.forEach((r) => fn.mockResolvedValueOnce(r));
  vi.stubGlobal('fetch', fn);
  return fn;
}

describe('_github helpers', () => {
  it('readFile returns null on 404', async () => {
    mockFetch(new Response('', { status: 404 }));
    expect(await readFile(env, 'src/content/listings/en/x.md')).toBeNull();
  });

  it('readFile decodes base64 content', async () => {
    const body = JSON.stringify({ content: btoa('hello'), sha: 'abc' });
    mockFetch(new Response(body, { status: 200 }));
    const r = await readFile(env, 'p.md');
    expect(r).toEqual({ content: 'hello', sha: 'abc' });
  });

  it('listDir returns [] on 404 and maps files only', async () => {
    mockFetch(new Response('', { status: 404 }));
    expect(await listDir(env, 'src/content/listings/en')).toEqual([]);

    const dir = JSON.stringify([
      { name: 'a.md', path: 'd/a.md', sha: '1', type: 'file' },
      { name: 'sub', path: 'd/sub', sha: '2', type: 'dir' },
    ]);
    mockFetch(new Response(dir, { status: 200 }));
    expect(await listDir(env, 'd')).toEqual([{ name: 'a.md', path: 'd/a.md', sha: '1' }]);
  });

  it('commitFile PUTs and returns the new commit sha', async () => {
    const fn = mockFetch(
      new Response('', { status: 404 }), // getSha → not found
      new Response(JSON.stringify({ commit: { sha: 'deadbeef' } }), { status: 200 }),
    );
    const sha = await commitFile(env, 'p.md', 'body', 'msg');
    expect(sha).toBe('deadbeef');
    const putCall = fn.mock.calls[1];
    expect(putCall[1].method).toBe('PUT');
  });

  it('commitFile throws on non-ok PUT', async () => {
    mockFetch(new Response('', { status: 404 }), new Response('', { status: 500 }));
    await expect(commitFile(env, 'p.md', 'b', 'm')).rejects.toThrow();
  });
});
