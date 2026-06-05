/// <reference types="@cloudflare/workers-types" />
import type { Env } from './_env';

// Gates every /api/* request. In production it verifies the Cloudflare Access
// JWT (defense-in-depth behind edge Access). Local dev bypasses when
// ENVIRONMENT=development, so no login is needed (.dev.vars).

interface Jwk {
  kid: string;
  kty: string;
  n: string;
  e: string;
  alg: string;
}

let jwksCache: { keys: Jwk[]; fetchedAt: number } | null = null;
const JWKS_TTL_MS = 60 * 60 * 1000; // 1h

async function getKeys(teamDomain: string, now: number): Promise<Jwk[]> {
  if (jwksCache && now - jwksCache.fetchedAt < JWKS_TTL_MS) return jwksCache.keys;
  const res = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error('failed to fetch Access JWKS');
  const { keys } = (await res.json()) as { keys: Jwk[] };
  jwksCache = { keys, fetchedAt: now };
  return keys;
}

function b64urlToBytes(s: string): Uint8Array<ArrayBuffer> {
  const b64 = s
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(s.length / 4) * 4, '=');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length); // ArrayBuffer-backed (not SharedArrayBuffer)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function verifyAccessJwt(token: string, env: Env, now: number): Promise<boolean> {
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [headerB64, payloadB64, sigB64] = parts;

  const header = JSON.parse(new TextDecoder().decode(b64urlToBytes(headerB64)));
  const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(payloadB64)));
  if (header.alg !== 'RS256') return false;

  // Claims: audience + expiry. (iss check is implicit via the team JWKS.)
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!aud.includes(env.CF_ACCESS_AUD)) return false;
  if (typeof payload.exp === 'number' && payload.exp * 1000 < now) return false;

  const keys = await getKeys(env.CF_ACCESS_TEAM_DOMAIN, now);
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) return false;

  const key = await crypto.subtle.importKey(
    'jwk',
    { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );

  const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  return crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlToBytes(sigB64), data);
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { env, request, next } = context;

  if (env.ENVIRONMENT === 'development') return next();

  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) return new Response('Unauthorized', { status: 401 });

  try {
    const ok = await verifyAccessJwt(token, env, Date.now());
    if (!ok) return new Response('Forbidden', { status: 403 });
  } catch {
    return new Response('Auth error', { status: 500 });
  }

  return next();
};
