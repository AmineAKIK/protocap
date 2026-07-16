import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createFailureRateLimiter,
  createSessionClaims,
  createSessionToken,
  hashAccessCode,
  parseCookies,
  verifyAccessCode,
  verifySessionToken,
} from './shiftguideSecurity.mjs';

test('access code hashes are verified without keeping the code in the hash', async () => {
  const hash = await hashAccessCode('atelier-42', Buffer.alloc(16, 7));
  assert.equal(hash.includes('atelier-42'), false);
  assert.equal(await verifyAccessCode('atelier-42', { hash }), true);
  assert.equal(await verifyAccessCode('incorrect', { hash }), false);
});

test('signed sessions reject tampering and enforce both expirations', () => {
  const now = 1_700_000_000_000;
  const secret = 'a-secret-long-enough-for-tests';
  const claims = createSessionClaims({ now, absoluteTtlMs: 8 * 60 * 60_000 });
  const token = createSessionToken(claims, secret);

  assert.equal(
    verifySessionToken(token, secret, { now: now + 10_000, idleTimeoutMs: 30 * 60_000 }).ok,
    true
  );
  assert.equal(
    verifySessionToken(`${token.slice(0, -1)}x`, secret, {
      now: now + 10_000,
      idleTimeoutMs: 30 * 60_000,
    }).ok,
    false
  );
  assert.equal(
    verifySessionToken(token, secret, {
      now: now + 30 * 60_000,
      idleTimeoutMs: 30 * 60_000,
    }).reason,
    'idle_expired'
  );
  assert.equal(
    verifySessionToken(token, secret, {
      now: now + 8 * 60 * 60_000,
      idleTimeoutMs: 30 * 60 * 60_000,
    }).reason,
    'absolute_expired'
  );
});

test('failed unlocks are throttled and reset after success', () => {
  const limiter = createFailureRateLimiter({
    maxFailures: 3,
    windowMs: 60_000,
    baseBlockMs: 10_000,
    maxBlockMs: 60_000,
  });
  const now = 10_000;

  assert.equal(limiter.recordFailure('client', now).allowed, true);
  assert.equal(limiter.recordFailure('client', now).allowed, true);
  const blocked = limiter.recordFailure('client', now);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterMs, 10_000);
  assert.equal(limiter.check('other-client', now).allowed, true);

  limiter.reset('client');
  assert.equal(limiter.check('client', now).allowed, true);
});

test('cookie parser tolerates malformed values and preserves signed tokens', () => {
  assert.deepEqual(parseCookies('a=1; shiftguide_session=payload.signature; broken=%E0%A4%A'), {
    a: '1',
    shiftguide_session: 'payload.signature',
  });
});
