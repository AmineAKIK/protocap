import {
  createHash,
  createHmac,
  randomBytes,
  scrypt as nodeScrypt,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(nodeScrypt);
const SESSION_VERSION = 1;
const CLOCK_SKEW_MS = 60_000;

function safeBufferEqual(left, right) {
  return left.length === right.length && timingSafeEqual(left, right);
}

function signPayload(payload, secret) {
  return createHmac('sha256', secret).update(payload).digest();
}

export function constantTimeTextEqual(left, right) {
  const leftDigest = createHash('sha256').update(String(left)).digest();
  const rightDigest = createHash('sha256').update(String(right)).digest();
  return timingSafeEqual(leftDigest, rightDigest);
}

export async function hashAccessCode(code, salt = randomBytes(16)) {
  const derived = await scrypt(String(code), salt, 32);
  return `scrypt$${Buffer.from(salt).toString('base64url')}$${Buffer.from(derived).toString('base64url')}`;
}

export async function verifyAccessCode(code, { hash = '', plain = '' } = {}) {
  if (typeof code !== 'string' || code.length === 0) return false;

  if (hash) {
    const [algorithm, encodedSalt, encodedExpected, ...extra] = hash.split('$');
    if (algorithm !== 'scrypt' || !encodedSalt || !encodedExpected || extra.length > 0) {
      return false;
    }

    try {
      const salt = Buffer.from(encodedSalt, 'base64url');
      const expected = Buffer.from(encodedExpected, 'base64url');
      if (salt.length < 8 || salt.length > 64 || expected.length < 16 || expected.length > 64) {
        return false;
      }
      const actual = Buffer.from(await scrypt(code, salt, expected.length));
      return safeBufferEqual(actual, expected);
    } catch {
      return false;
    }
  }

  return plain.length > 0 && constantTimeTextEqual(code, plain);
}

export function createSessionClaims({ now = Date.now(), absoluteTtlMs }) {
  return {
    v: SESSION_VERSION,
    sid: randomBytes(18).toString('base64url'),
    iat: now,
    last: now,
    absoluteExpiresAt: now + absoluteTtlMs,
  };
}

export function createSessionToken(claims, secret) {
  if (!secret) throw new Error('A session signing secret is required.');
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const signature = signPayload(payload, secret).toString('base64url');
  return `${payload}.${signature}`;
}

export function verifySessionToken(
  token,
  secret,
  { now = Date.now(), idleTimeoutMs } = {}
) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 4096 || !secret) {
    return { ok: false, reason: 'invalid' };
  }

  const parts = token.split('.');
  if (parts.length !== 2) return { ok: false, reason: 'invalid' };
  const [payload, encodedSignature] = parts;

  try {
    const suppliedSignature = Buffer.from(encodedSignature, 'base64url');
    const expectedSignature = signPayload(payload, secret);
    if (!safeBufferEqual(suppliedSignature, expectedSignature)) {
      return { ok: false, reason: 'invalid' };
    }

    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    const validShape =
      claims?.v === SESSION_VERSION &&
      typeof claims.sid === 'string' &&
      /^[A-Za-z0-9_-]{16,128}$/.test(claims.sid) &&
      Number.isSafeInteger(claims.iat) &&
      Number.isSafeInteger(claims.last) &&
      Number.isSafeInteger(claims.absoluteExpiresAt) &&
      claims.iat <= claims.last &&
      claims.last < claims.absoluteExpiresAt &&
      claims.iat <= now + CLOCK_SKEW_MS &&
      claims.last <= now + CLOCK_SKEW_MS;

    if (!validShape) return { ok: false, reason: 'invalid' };
    if (now >= claims.absoluteExpiresAt) return { ok: false, reason: 'absolute_expired' };
    if (!Number.isFinite(idleTimeoutMs) || idleTimeoutMs <= 0) {
      return { ok: false, reason: 'invalid' };
    }
    if (now >= claims.last + idleTimeoutMs) return { ok: false, reason: 'idle_expired' };

    return { ok: true, claims };
  } catch {
    return { ok: false, reason: 'invalid' };
  }
}

export function refreshSessionClaims(claims, now = Date.now()) {
  return { ...claims, last: now };
}

export function parseCookies(header = '') {
  const cookies = {};
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator <= 0) continue;
    const name = part.slice(0, separator).trim();
    const rawValue = part.slice(separator + 1).trim();
    if (!name) continue;
    try {
      cookies[name] = decodeURIComponent(rawValue);
    } catch {
      // Ignore malformed cookie values rather than failing the whole request.
    }
  }
  return cookies;
}

export function createFailureRateLimiter({
  maxFailures = 5,
  windowMs = 15 * 60_000,
  baseBlockMs = 30_000,
  maxBlockMs = 15 * 60_000,
} = {}) {
  const attempts = new Map();

  const normalize = (key) => String(key || 'unknown');

  function getCurrent(key, now) {
    const normalizedKey = normalize(key);
    const current = attempts.get(normalizedKey);
    if (!current || now - current.windowStartedAt >= windowMs) {
      const fresh = { failures: 0, windowStartedAt: now, blockedUntil: 0 };
      attempts.set(normalizedKey, fresh);
      return fresh;
    }
    return current;
  }

  function check(key, now = Date.now()) {
    const current = getCurrent(key, now);
    const retryAfterMs = Math.max(0, current.blockedUntil - now);
    return { allowed: retryAfterMs === 0, retryAfterMs, failures: current.failures };
  }

  function recordFailure(key, now = Date.now()) {
    const current = getCurrent(key, now);
    current.failures += 1;

    if (current.failures >= maxFailures) {
      const exponent = Math.min(current.failures - maxFailures, 8);
      const duration = Math.min(maxBlockMs, baseBlockMs * 2 ** exponent);
      current.blockedUntil = Math.max(current.blockedUntil, now + duration);
    }

    return check(key, now);
  }

  function reset(key) {
    attempts.delete(normalize(key));
  }

  function prune(now = Date.now()) {
    for (const [key, entry] of attempts) {
      if (now - entry.windowStartedAt >= windowMs && now >= entry.blockedUntil) {
        attempts.delete(key);
      }
    }
  }

  return { check, recordFailure, reset, prune, size: () => attempts.size };
}
