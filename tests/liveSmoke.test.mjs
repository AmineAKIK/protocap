import assert from 'node:assert/strict';
import test from 'node:test';
import { runLiveSmoke } from '../scripts/live-smoke.mjs';

const SECURITY_HEADERS = {
  'content-security-policy': "default-src 'self'; frame-ancestors 'none'",
  'cross-origin-opener-policy': 'same-origin',
  'cross-origin-resource-policy': 'same-origin',
  'permissions-policy': 'camera=(), geolocation=(), microphone=(self)',
  'referrer-policy': 'no-referrer',
  'strict-transport-security': 'max-age=31536000',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
};

function response(body, { headers = {}, json = false } = {}) {
  return new Response(json ? JSON.stringify(body) : body, {
    status: 200,
    headers: {
      ...SECURITY_HEADERS,
      ...headers,
      ...(json ? { 'content-type': 'application/json' } : {}),
    },
  });
}

test('live smoke checks only public non-mutating production surfaces', async () => {
  const requested = [];
  const fetchImpl = async (url, init) => {
    const { pathname } = new URL(url);
    requested.push({ pathname, method: init?.method });

    if (pathname === '/') {
      return response('<!doctype html><title>ProtoCap — démonstrateur</title>', {
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    }
    if (pathname === '/api/health') {
      return response({ ok: true }, {
        json: true,
        headers: { 'cache-control': 'no-store', 'x-request-id': 'smoke-health-1' },
      });
    }
    if (pathname === '/api/ready') {
      return response({ ok: true, checks: {} }, {
        json: true,
        headers: { 'cache-control': 'no-store', 'x-request-id': 'smoke-ready-1' },
      });
    }
    if (pathname === '/robots.txt') {
      return response('User-agent: *\nAllow: /\n\nSitemap: https://example.test/sitemap.xml\n');
    }
    throw new Error(`Unexpected smoke request: ${pathname}`);
  };

  const result = await runLiveSmoke({
    baseUrl: 'https://example.test',
    fetchImpl,
    log: () => {},
  });

  assert.deepEqual(result.checked, ['/', '/api/health', '/api/ready', '/robots.txt']);
  assert.deepEqual(
    requested,
    [
      { pathname: '/', method: 'GET' },
      { pathname: '/api/health', method: 'GET' },
      { pathname: '/api/ready', method: 'GET' },
      { pathname: '/robots.txt', method: 'GET' },
    ]
  );
  assert.ok(requested.every(({ pathname }) => !pathname.includes('unlock')));
  assert.ok(requested.every(({ pathname }) => !pathname.includes('celine')));
});

test('live smoke refuses a non-HTTPS target before making a request', async () => {
  let called = false;

  await assert.rejects(
    runLiveSmoke({
      baseUrl: 'http://example.test',
      fetchImpl: async () => {
        called = true;
        throw new Error('must not be called');
      },
      log: () => {},
    }),
    /must use HTTPS/
  );

  assert.equal(called, false);
});
