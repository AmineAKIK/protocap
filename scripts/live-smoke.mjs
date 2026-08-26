import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

export const DEFAULT_BASE_URL = 'https://protocap-production.up.railway.app';

const REQUIRED_SECURITY_HEADERS = {
  'content-security-policy': "default-src 'self'",
  'cross-origin-opener-policy': 'same-origin',
  'cross-origin-resource-policy': 'same-origin',
  'permissions-policy': 'camera=()',
  'referrer-policy': 'no-referrer',
  'strict-transport-security': 'max-age=31536000',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
};

function normalizeBaseUrl(raw) {
  const url = new URL(raw);
  assert.equal(url.protocol, 'https:', 'live smoke target must use HTTPS');
  assert.equal(url.username, '', 'live smoke target must not contain credentials');
  assert.equal(url.password, '', 'live smoke target must not contain credentials');
  url.pathname = '/';
  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/$/, '');
}

async function get(fetchImpl, baseUrl, path) {
  const response = await fetchImpl(`${baseUrl}${path}`, {
    method: 'GET',
    redirect: 'error',
    signal: AbortSignal.timeout(10_000),
    headers: {
      'user-agent': 'ProtoCap-live-smoke/1.0',
    },
  });
  assert.equal(response.status, 200, `${path} must return HTTP 200`);
  return response;
}

function assertSecurityHeaders(response, path) {
  for (const [name, expectedFragment] of Object.entries(REQUIRED_SECURITY_HEADERS)) {
    const value = response.headers.get(name);
    assert.ok(value, `${path} must return ${name}`);
    assert.ok(
      value.includes(expectedFragment),
      `${path} ${name} must include ${JSON.stringify(expectedFragment)}`
    );
  }
}

function assertRequestId(response, path) {
  assert.match(
    response.headers.get('x-request-id') ?? '',
    /^[A-Za-z0-9._:-]{1,128}$/,
    `${path} must return a bounded request id`
  );
}

export async function runLiveSmoke({
  baseUrl = process.env.PROTOCAP_BASE_URL || DEFAULT_BASE_URL,
  fetchImpl = fetch,
  log = console.log,
} = {}) {
  const target = normalizeBaseUrl(baseUrl);
  const results = [];

  const home = await get(fetchImpl, target, '/');
  assertSecurityHeaders(home, '/');
  assert.match(home.headers.get('content-type') ?? '', /text\/html/i);
  const homeBody = await home.text();
  assert.match(homeBody, /<title>[^<]*ProtoCap/i, '/ must expose the ProtoCap document title');
  results.push('/');

  const health = await get(fetchImpl, target, '/api/health');
  assertSecurityHeaders(health, '/api/health');
  assertRequestId(health, '/api/health');
  assert.match(health.headers.get('cache-control') ?? '', /no-store/i);
  assert.deepEqual(await health.json(), { ok: true });
  results.push('/api/health');

  const ready = await get(fetchImpl, target, '/api/ready');
  assertSecurityHeaders(ready, '/api/ready');
  assertRequestId(ready, '/api/ready');
  assert.match(ready.headers.get('cache-control') ?? '', /no-store/i);
  const readiness = await ready.json();
  assert.equal(readiness.ok, true, '/api/ready must report ok=true');
  results.push('/api/ready');

  const robots = await get(fetchImpl, target, '/robots.txt');
  assertSecurityHeaders(robots, '/robots.txt');
  const robotsBody = await robots.text();
  assert.match(robotsBody, /^User-agent:\s*\*/m);
  assert.match(robotsBody, /^Allow:\s*\/$/m);
  assert.match(robotsBody, new RegExp(`^Sitemap:\\s*${target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/sitemap\\.xml$`, 'm'));
  results.push('/robots.txt');

  log(`ProtoCap live smoke passed: ${results.join(', ')}`);
  return { baseUrl: target, checked: results };
}

const invokedDirectly = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

if (invokedDirectly) {
  runLiveSmoke().catch((error) => {
    console.error(error instanceof Error ? error.stack : error);
    process.exitCode = 1;
  });
}
