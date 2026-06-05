import { describe, it, expect } from 'vitest';
import { loadSession, saveSession, clearSession, type WizardSession } from './_session';
import type { Env } from '../api/_env';

// Minimal in-memory KV stand-in.
function fakeKv() {
  const store = new Map<string, string>();
  return {
    get: (k: string) => Promise.resolve(store.get(k) ?? null),
    put: (k: string, v: string) => {
      store.set(k, v);
      return Promise.resolve();
    },
    delete: (k: string) => {
      store.delete(k);
      return Promise.resolve();
    },
  };
}

const envWith = (kv: ReturnType<typeof fakeKv>) => ({ SESSIONS: kv }) as unknown as Env;

describe('session store', () => {
  it('returns null when no session exists', async () => {
    expect(await loadSession(envWith(fakeKv()), 1)).toBeNull();
  });

  it('round-trips a session', async () => {
    const kv = fakeKv();
    const env = envWith(kv);
    const s: WizardSession = { step: 'title', draft: { locale: 'en' }, updatedAt: 0 };
    await saveSession(env, 42, s);
    expect(await loadSession(env, 42)).toEqual(s);
  });

  it('clears a session', async () => {
    const kv = fakeKv();
    const env = envWith(kv);
    await saveSession(env, 7, { step: 'title', draft: {}, updatedAt: 0 });
    await clearSession(env, 7);
    expect(await loadSession(env, 7)).toBeNull();
  });
});
