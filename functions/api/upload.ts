/// <reference types="@cloudflare/workers-types" />
import type { Env } from './_env';

// POST multipart/form-data { file, prefix? }
// Puts a binary to R2 and returns its key. Binaries never enter git;
// the front end renders them from the R2 public base.

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'application/pdf']);
const MAX_BYTES = 15 * 1024 * 1024; // 15 MB

// "photos/2024/<rand>-<name>.jpg" — collision-resistant without Date/Math here.
function buildKey(prefix: string, filename: string): string {
  const safe = filename
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const rand = crypto.randomUUID().slice(0, 8);
  const clean = prefix.replace(/[^a-z0-9/_-]/gi, '').replace(/^\/+|\/+$/g, '') || 'uploads';
  return `${clean}/${rand}-${safe}`;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: 'expected multipart/form-data' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return Response.json({ error: 'file is required' }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return Response.json({ error: `unsupported type: ${file.type}` }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: 'file too large' }, { status: 413 });
  }

  const prefix = (form.get('prefix') as string | null) ?? 'photos';
  const key = buildKey(prefix, file.name);

  await env.MEDIA.put(key, file.stream(), {
    httpMetadata: { contentType: file.type },
  });

  return Response.json({ ok: true, key });
};
