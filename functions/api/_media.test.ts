import { describe, it, expect } from 'vitest';
import { buildKey, ALLOWED, MAX_BYTES } from './_media';

describe('_media helpers', () => {
  it('buildKey sanitizes filename and applies prefix', () => {
    const key = buildKey('listings/photos', 'My Photo!.JPG');
    expect(key).toMatch(/^listings\/photos\/[a-z0-9]{8}-my-photo-.jpg$/);
  });

  it('buildKey falls back to uploads for an empty prefix', () => {
    expect(buildKey('', 'a.png')).toMatch(/^uploads\//);
  });

  it('exposes allowed types and size cap', () => {
    expect(ALLOWED.has('image/jpeg')).toBe(true);
    expect(ALLOWED.has('text/plain')).toBe(false);
    expect(MAX_BYTES).toBe(15 * 1024 * 1024);
  });
});
