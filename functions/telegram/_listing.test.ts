import { describe, it, expect, vi } from 'vitest';
import { resolveSlug, finalizeListing, buildListingEntry } from './_listing';

describe('resolveSlug', () => {
  it('returns the base slug when free', async () => {
    const exists = vi.fn().mockResolvedValue(false);
    expect(await resolveSlug(exists, 'en', 'Sunny Villa!')).toBe('sunny-villa');
  });

  it('appends a counter on collision', async () => {
    const exists = vi
      .fn()
      .mockResolvedValueOnce(true) // sunny-villa taken
      .mockResolvedValueOnce(false); // sunny-villa-2 free
    expect(await resolveSlug(exists, 'en', 'Sunny Villa')).toBe('sunny-villa-2');
  });

  it('falls back to "listing" for an empty title', async () => {
    const exists = vi.fn().mockResolvedValue(false);
    expect(await resolveSlug(exists, 'en', '!!!')).toBe('listing');
  });
});

describe('finalizeListing', () => {
  it('fills defaults and derives translationKey from slug', () => {
    const m = finalizeListing({ locale: 'en', title: 'X', slug: 'x', price: 100 });
    expect(m.translationKey).toBe('x');
    expect(m.currency).toBe('USD');
    expect(m.status).toBe('draft');
    expect(m.coords).toEqual({ lat: 0, lng: 0 });
    expect(m.photos).toEqual([]);
  });
});

describe('buildListingEntry', () => {
  it('produces the locale-scoped path and YAML frontmatter', () => {
    const entry = buildListingEntry({
      locale: 'en',
      title: 'X',
      slug: 'x',
      price: 100,
      propertyType: 'house',
    });
    expect(entry.path).toBe('src/content/listings/en/x.md');
    expect(entry.content).toContain('title: X');
    expect(entry.content).toContain('propertyType: house');
  });
});
