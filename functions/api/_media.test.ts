import { describe, it, expect } from 'vitest';
import { buildKey, putMedia, ALLOWED, MAX_BYTES } from './_media';
import type { Env } from './_env';

describe('_media helpers', () => {
  it('buildKey sanitizes filename and applies prefix', () => {
    const key = buildKey('listings/photos', 'My Photo!.JPG');
    expect(key).toMatch(/^listings\/photos\/[a-z0-9]{8}-my-photo-\.jpg$/);
  });

  it('buildKey falls back to uploads for an empty prefix', () => {
    expect(buildKey('', 'a.png')).toMatch(/^uploads\//);
  });

  it('exposes allowed types and size cap', () => {
    expect(ALLOWED.has('image/jpeg')).toBe(true);
    expect(ALLOWED.has('text/plain')).toBe(false);
    expect(MAX_BYTES).toBe(15 * 1024 * 1024);
  });

  it('putMedia forwards key, body, and contentType to R2', async () => {
    const calls: unknown[] = [];
    const env = {
      MEDIA: {
        put: (...args: unknown[]) => {
          calls.push(args);
          return Promise.resolve();
        },
      },
    } as unknown as Env;
    await putMedia(env, new Uint8Array([1, 2, 3]), 'image/jpeg', 'photos/x.jpg');
    expect(calls[0]).toEqual([
      'photos/x.jpg',
      new Uint8Array([1, 2, 3]),
      { httpMetadata: { contentType: 'image/jpeg' } },
    ]);
  });
});
