import { describe, it, expect } from 'vitest';
import { withStatus } from './_status';

describe('withStatus', () => {
  it('replaces the status frontmatter field, preserving the body', () => {
    const raw = `---\ntitle: X\nslug: x\nstatus: draft\nprice: 100\n---\n\nBody text.\n`;
    const out = withStatus(raw, 'sold');
    expect(out).toContain('status: sold');
    expect(out).not.toContain('status: draft');
    expect(out).toContain('Body text.');
  });
});
