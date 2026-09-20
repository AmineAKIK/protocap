import assert from 'node:assert/strict';
import test from 'node:test';
import { ESSAY_PDF_PATH, runLiveSmoke } from '../scripts/live-smoke.mjs';

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

function response(body, {
  status = 200,
  headers = {},
  json = false,
} = {}) {
  return new Response(json ? JSON.stringify(body) : body, {
    status,
    headers: {
      ...SECURITY_HEADERS,
      ...headers,
      ...(json ? { 'content-type': 'application/json' } : {}),
    },
  });
}

function api(body, requestId) {
  return response(body, {
    json: true,
    headers: { 'cache-control': 'no-store', 'x-request-id': requestId },
  });
}

test('T44/T45 live smoke checks protected and demo public surfaces without protected or AI mutations', async () => {
  const requested = [];
  const protectedOrigin = 'https://app.example.test';
  const demoOrigin = 'https://demo.example.test';

  const fetchImpl = async (url, init) => {
    const parsed = new URL(url);
    requested.push({
      origin: parsed.origin,
      pathname: parsed.pathname,
      method: init?.method,
      redirect: init?.redirect,
    });

    if (parsed.origin === protectedOrigin) {
      if (parsed.pathname === '/') {
        return response('<!doctype html><title>ProtoCap — démonstrateur</title>', {
          headers: { 'content-type': 'text/html; charset=utf-8' },
        });
      }
      if (parsed.pathname === '/api/health') return api({ ok: true }, 'protected-health');
      if (parsed.pathname === '/api/ready') return api({ ok: true, checks: {} }, 'protected-ready');
      if (parsed.pathname === '/api/public-demo') {
        return api({
          available: true,
          selfServe: false,
          entryUrl: demoOrigin + '/demo',
        }, 'protected-demo');
      }
      if (parsed.pathname === '/robots.txt') {
        return response('User-agent: *\nAllow: /\n\nSitemap: ' + protectedOrigin + '/sitemap.xml\n');
      }
      if (parsed.pathname === '/manifest.webmanifest') {
        return response({ name: 'ProtoCap', short_name: 'ProtoCap' }, {
          json: true,
          headers: { 'content-type': 'application/manifest+json' },
        });
      }
      if (parsed.pathname === '/sw.js') {
        return response('self.addEventListener("fetch", () => {});', {
          headers: { 'content-type': 'application/javascript' },
        });
      }
      if (parsed.pathname === ESSAY_PDF_PATH) {
        return response(Buffer.from('%PDF-fixture'), {
          headers: { 'content-type': 'application/pdf' },
        });
      }
    }

    if (parsed.origin === demoOrigin) {
      if (parsed.pathname === '/api/health') return api({ ok: true }, 'demo-health');
      if (parsed.pathname === '/api/ready') return api({ ok: true, checks: {} }, 'demo-ready');
      if (parsed.pathname === '/api/public-demo') {
        return api({ available: true, selfServe: true, entryUrl: '/demo' }, 'demo-public');
      }
      if (parsed.pathname === '/demo') {
        return response(
          '<!doctype html><head>' +
          '<meta name="protocap-runtime-profile" content="demo">' +
          '<meta name="protocap-public-origin" content="' + protectedOrigin + '">' +
          '</head>',
          { headers: { 'content-type': 'text/html; charset=utf-8' } }
        );
      }
      if (parsed.pathname === '/manifest.webmanifest') {
        return response({ name: 'ShiftGuide démo', start_url: '/demo' }, {
          json: true,
          headers: {
            'content-type': 'application/manifest+json',
            'cache-control': 'no-store',
          },
        });
      }
      if (parsed.pathname === '/sw.js') {
        return response('self.addEventListener("activate",()=>caches.keys());', {
          headers: {
            'content-type': 'application/javascript',
            'cache-control': 'no-store',
          },
        });
      }
      if (parsed.pathname === '/' || parsed.pathname === '/rapport') {
        return response('', {
          status: 302,
          headers: {
            location: protectedOrigin + parsed.pathname,
            'cache-control': 'no-store',
          },
        });
      }
      if (parsed.pathname === ESSAY_PDF_PATH) {
        return response('Asset introuvable.', {
          status: 404,
          headers: { 'content-type': 'text/plain' },
        });
      }
    }

    throw new Error('Unexpected smoke request: ' + parsed.origin + parsed.pathname);
  };

  const result = await runLiveSmoke({
    baseUrl: protectedOrigin,
    demoBaseUrl: demoOrigin,
    fetchImpl,
    log: () => {},
  });

  assert.equal(result.protectedOrigin, protectedOrigin);
  assert.equal(result.demoOrigin, demoOrigin);
  assert.deepEqual(result.protectedChecks, [
    '/',
    '/api/health',
    '/api/ready',
    '/api/public-demo',
    '/robots.txt',
    '/manifest.webmanifest',
    '/sw.js',
    ESSAY_PDF_PATH,
  ]);
  assert.deepEqual(result.demoChecks, [
    '/api/health',
    '/api/ready',
    '/api/public-demo',
    '/demo',
    '/manifest.webmanifest',
    '/sw.js',
    '/ -> protected',
    '/rapport -> protected',
    ESSAY_PDF_PATH + ' -> 404',
  ]);
  assert.ok(requested.every(({ method }) => method === 'GET'));
  assert.ok(requested.every(({ pathname }) => !pathname.includes('unlock')));
  assert.ok(requested.every(({ pathname }) => !pathname.includes('celine')));
  assert.ok(requested.every(({ pathname }) => !pathname.includes('/session')));
});

test('live smoke refuses non-HTTPS or identical targets before making a request', async () => {
  let called = false;
  const fetchImpl = async () => {
    called = true;
    throw new Error('must not be called');
  };

  await assert.rejects(
    runLiveSmoke({
      baseUrl: 'http://example.test',
      demoBaseUrl: 'https://demo.example.test',
      fetchImpl,
      log: () => {},
    }),
    /must use HTTPS/
  );

  await assert.rejects(
    runLiveSmoke({
      baseUrl: 'https://same.example.test',
      demoBaseUrl: 'https://same.example.test',
      fetchImpl,
      log: () => {},
    }),
    /must be distinct origins/
  );

  assert.equal(called, false);
});
