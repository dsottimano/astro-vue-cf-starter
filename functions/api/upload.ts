/// <reference types="@cloudflare/workers-types" />
import type { Env } from './_env';
import { ALLOWED, MAX_BYTES, buildKey, putMedia } from './_media';

// POST multipart/form-data { file, prefix? }
// Puts a binary to R2 and returns its key.

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
  await putMedia(env, file.stream(), file.type, key);

  return Response.json({ ok: true, key });
};
