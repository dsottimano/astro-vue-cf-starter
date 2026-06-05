// Thin client over the /api/* Functions. Auth is handled by Cloudflare Access
// (edge) + the /api middleware — these calls carry the session cookie.

export interface ListEntry {
  name: string;
  path: string;
  sha: string;
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = '';
    try {
      detail = ((await res.json()) as { error?: string }).error ?? '';
    } catch {
      /* ignore */
    }
    throw new Error(detail || `request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  list(dir: string): Promise<ListEntry[]> {
    return fetch(`/api/list?dir=${encodeURIComponent(dir)}`)
      .then((r) => jsonOrThrow<{ entries: ListEntry[] }>(r))
      .then((d) => d.entries);
  },

  read(path: string): Promise<{ content: string; sha: string }> {
    return fetch(`/api/entry?path=${encodeURIComponent(path)}`).then((r) =>
      jsonOrThrow<{ content: string; sha: string }>(r),
    );
  },

  commit(path: string, content: string, message?: string): Promise<{ commit: string }> {
    return fetch('/api/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, content, message }),
    }).then((r) => jsonOrThrow<{ commit: string }>(r));
  },

  remove(path: string): Promise<{ ok: boolean }> {
    return fetch(`/api/entry?path=${encodeURIComponent(path)}`, { method: 'DELETE' }).then((r) =>
      jsonOrThrow<{ ok: boolean }>(r),
    );
  },

  upload(file: File, prefix: string): Promise<string> {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('prefix', prefix);
    return fetch('/api/upload', { method: 'POST', body: fd })
      .then((r) => jsonOrThrow<{ key: string }>(r))
      .then((d) => d.key);
  },
};
