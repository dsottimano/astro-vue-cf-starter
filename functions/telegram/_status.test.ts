import { describe, it, expect } from 'vitest';
import { withStatus, pathForSlug, isStatusCallback } from './_status';

describe('withStatus', () => {
  it('replaces the status frontmatter field, preserving the body', () => {
    const raw = `---\ntitle: X\nslug: x\nstatus: draft\nprice: 100\n---\n\nBody text.\n`;
    const out = withStatus(raw, 'sold');
    expect(out).toContain('status: sold');
    expect(out).not.toContain('status: draft');
    expect(out).toContain('Body text.');
  });
});

describe('pathForSlug', () => {
  it('builds the en listings path from a slug', () => {
    expect(pathForSlug('sunny-villa')).toBe('src/content/listings/en/sunny-villa.md');
  });
});

describe('isStatusCallback', () => {
  it('matches pick: and set: prefixes only', () => {
    expect(isStatusCallback('pick:x')).toBe(true);
    expect(isStatusCallback('set:sold:x')).toBe(true);
    expect(isStatusCallback('loc:en')).toBe(false);
  });
});
