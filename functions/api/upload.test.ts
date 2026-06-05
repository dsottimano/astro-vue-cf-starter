import { describe, it, expect } from 'vitest';
import { onRequestPost } from './upload';
import type { Env } from './_env';

// MEDIA is never reached in the validation branches under test.
const env = { MEDIA: {} } as unknown as Env;

function call(body: BodyInit, headers?: HeadersInit) {
  const request = new Request('https://x/api/upload', { method: 'POST', body, headers });
  return onRequestPost({ request, env } as never);
}

describe('POST /api/upload validation', () => {
  it('rejects non-multipart bodies', async () => {
    const res = await call('plain', { 'Content-Type': 'text/plain' });
    expect(res.status).toBe(400);
  });

  it('rejects when file field is missing', async () => {
    const res = await call(new FormData());
    expect(res.status).toBe(400);
  });

  it('rejects unsupported content types', async () => {
    const fd = new FormData();
    fd.append('file', new File(['x'], 'note.txt', { type: 'text/plain' }));
    const res = await call(fd);
    expect(res.status).toBe(415);
  });

  it('accepts an allowed image type', async () => {
    const put = (key: string) => Promise.resolve({ key });
    const okEnv = { MEDIA: { put } } as unknown as Env;
    const fd = new FormData();
    fd.append('file', new File(['x'], 'photo.png', { type: 'image/png' }));
    const request = new Request('https://x/api/upload', { method: 'POST', body: fd });
    const res = await onRequestPost({ request, env: okEnv } as never);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true });
  });
});
