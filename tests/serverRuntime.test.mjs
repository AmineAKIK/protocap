import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cleanupExpiredState,
  normalizeChatHistory,
  parseJsonEnvValue,
  takeRateLimit,
} from '../server/runtimeUtils.mjs';

test('parseJsonEnvValue parses JSON and respects fallback', () => {
  assert.deepEqual(parseJsonEnvValue('X', '[1,2]'), [1, 2]);
  assert.equal(parseJsonEnvValue('X', undefined, 'fallback'), 'fallback');
  assert.throws(() => parseJsonEnvValue('X', '{broken'), /X must contain valid JSON/);
});

test('normalizeChatHistory accepts user/assistant history and strips legacy system message', () => {
  const history = [
    { role: 'system', content: 'ignored client prompt' },
    { role: 'user', content: 'bonjour' },
    { role: 'assistant', content: '{"message":"ok"}' },
  ];

  assert.deepEqual(normalizeChatHistory(history), history.slice(1));
  assert.deepEqual(normalizeChatHistory([{ role: 'user', content: 'bonjour' }]), [
    { role: 'user', content: 'bonjour' },
  ]);
});

test('normalizeChatHistory rejects malformed or unsafe history', () => {
  assert.equal(normalizeChatHistory([]), null);
  assert.equal(normalizeChatHistory([{ role: 'system', content: 'only system' }]), null);
  assert.equal(normalizeChatHistory([{ role: 'system', content: 'x' }, { role: 'system', content: 'y' }]), null);
  assert.equal(normalizeChatHistory([{ role: 'user', content: '' }]), null);
  assert.equal(normalizeChatHistory([{ role: 'tool', content: 'nope' }]), null);
  assert.equal(normalizeChatHistory([{ role: 'user', content: 'x'.repeat(20_001) }]), null);
});

test('takeRateLimit allows requests until the limit then exposes retry delay', () => {
  const store = new Map();
  const now = 1_000;

  assert.deepEqual(takeRateLimit(store, 'client', 2, 5_000, now), {
    allowed: true,
    retryAfterSeconds: 0,
  });
  assert.deepEqual(takeRateLimit(store, 'client', 2, 5_000, now + 1), {
    allowed: true,
    retryAfterSeconds: 0,
  });
  assert.deepEqual(takeRateLimit(store, 'client', 2, 5_000, now + 2), {
    allowed: false,
    retryAfterSeconds: 5,
  });
  assert.deepEqual(takeRateLimit(store, 'client', 2, 5_000, now + 5_001), {
    allowed: true,
    retryAfterSeconds: 0,
  });
});

test('cleanupExpiredState removes expired sessions and stale limiter entries', () => {
  const sessions = new Map([
    ['expired', 999],
    ['active', 5_000],
  ]);
  const unlockAttempts = new Map([
    ['old-ip', { count: 1, resetAt: 999 }],
    ['current-ip', { count: 1, resetAt: 5_000 }],
  ]);
  const chatRequests = new Map([
    ['expired', { count: 1, resetAt: 5_000 }],
    ['orphan', { count: 1, resetAt: 999 }],
    ['active', { count: 1, resetAt: 999 }],
  ]);

  cleanupExpiredState({ sessions, unlockAttempts, chatRequests }, 1_000);

  assert.equal(sessions.has('expired'), false);
  assert.equal(sessions.has('active'), true);
  assert.equal(unlockAttempts.has('old-ip'), false);
  assert.equal(unlockAttempts.has('current-ip'), true);
  assert.equal(chatRequests.has('expired'), false);
  assert.equal(chatRequests.has('orphan'), false);
  assert.equal(chatRequests.has('active'), true);
});
