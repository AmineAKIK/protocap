import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

export const DEFAULT_BASE_URL = 'https://protocap-production.up.railway.app';
export const DEFAULT_DEMO_BASE_URL = 'https://protocap-demo-production.up.railway.app';
export const ESSAY_PDF_PATH = '/rendre-l-attention-au-reel-akik-mohamed-amine.pdf';

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

function escapeRegex(value) {
  return value.replace(/[.*+?^$(){}|[\]\\]/g, '\\$&');
}

function normalizeBaseUrl(raw, label) {
  const url = new URL(raw);
  assert.equal(url.protocol, 'https:', label + ' live smoke target must use HTTPS');
  assert.equal(url.username, '', label + ' live smoke target must not contain credentials');
  assert.equal(url.password, '', label + ' live smoke target must not contain credentials');
  url.pathname = '/';
  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/$/, '');
}

async function request(fetchImpl, baseUrl, path, {
  status = 200,
  redirect = 'error',
} = {}) {
  const response = await fetchImpl(baseUrl + path, {
    method: 'GET',
    redirect,
    signal: AbortSignal.timeout(10_000),
    headers: {
      'user-agent': 'ProtoCap-live-smoke/2.0',
    },
  });
  assert.equal(response.status, status, baseUrl + path + ' must return HTTP ' + status);
  return response;
}

function assertSecurityHeaders(response, label) {
  for (const [name, expectedFragment] of Object.entries(REQUIRED_SECURITY_HEADERS)) {
    const value = response.headers.get(name);
    assert.ok(value, label + ' must return ' + name);
    assert.ok(
      value.includes(expectedFragment),
      label + ' ' + name + ' must include ' + JSON.stringify(expectedFragment)
    );
  }
}

function assertRequestId(response, label) {
  assert.match(
    response.headers.get('x-request-id') ?? '',
    /^[A-Za-z0-9._:-]{1,128}$/,
    label + ' must return a bounded request id'
  );
}

function assertNoStore(response, label) {
  assert.match(response.headers.get('cache-control') ?? '', /no-store/i, label + ' must be no-store');
}

async function checkJsonApi(fetchImpl, baseUrl, path) {
  const response = await request(fetchImpl, baseUrl, path);
  const label = baseUrl + path;
  assertSecurityHeaders(response, label);
  assertRequestId(response, label);
  assertNoStore(response, label);
  return { response, body: await response.json() };
}

export async function runLiveSmoke({
  baseUrl = process.env.PROTOCAP_BASE_URL || DEFAULT_BASE_URL,
  demoBaseUrl = process.env.PROTOCAP_DEMO_BASE_URL || DEFAULT_DEMO_BASE_URL,
  fetchImpl = fetch,
  log = console.log,
} = {}) {
  const protectedOrigin = normalizeBaseUrl(baseUrl, 'protected');
  const demoOrigin = normalizeBaseUrl(demoBaseUrl, 'demo');
  assert.notEqual(protectedOrigin, demoOrigin, 'protected and demo live smoke targets must be distinct origins');

  const protectedChecks = [];
  const demoChecks = [];

  const home = await request(fetchImpl, protectedOrigin, '/');
  assertSecurityHeaders(home, protectedOrigin + '/');
  assert.match(home.headers.get('content-type') ?? '', /text\/html/i);
  const homeBody = await home.text();
  assert.match(homeBody, /<title>[^<]*ProtoCap/i, '/ must expose the ProtoCap document title');
  protectedChecks.push('/');

  const health = await checkJsonApi(fetchImpl, protectedOrigin, '/api/health');
  assert.deepEqual(health.body, { ok: true });
  protectedChecks.push('/api/health');

  const ready = await checkJsonApi(fetchImpl, protectedOrigin, '/api/ready');
  assert.equal(ready.body.ok, true, '/api/ready must report ok=true');
  protectedChecks.push('/api/ready');

  const publicDemo = await checkJsonApi(fetchImpl, protectedOrigin, '/api/public-demo');
  assert.deepEqual(publicDemo.body, {
    available: true,
    selfServe: false,
    entryUrl: demoOrigin + '/demo',
  });
  protectedChecks.push('/api/public-demo');

  const robots = await request(fetchImpl, protectedOrigin, '/robots.txt');
  assertSecurityHeaders(robots, protectedOrigin + '/robots.txt');
  const robotsBody = await robots.text();
  assert.match(robotsBody, /^User-agent:\s*\*/m);
  assert.match(robotsBody, /^Allow:\s*\/$/m);
  assert.match(
    robotsBody,
    new RegExp('^Sitemap:\\s*' + escapeRegex(protectedOrigin) + '/sitemap\\.xml$', 'm')
  );
  protectedChecks.push('/robots.txt');

  const manifest = await request(fetchImpl, protectedOrigin, '/manifest.webmanifest');
  assertSecurityHeaders(manifest, protectedOrigin + '/manifest.webmanifest');
  assert.match(manifest.headers.get('content-type') ?? '', /manifest|json/i);
  const manifestBody = await manifest.json();
  assert.equal(manifestBody.name, 'ProtoCap');
  assert.equal(manifestBody.short_name, 'ProtoCap');
  protectedChecks.push('/manifest.webmanifest');

  const worker = await request(fetchImpl, protectedOrigin, '/sw.js');
  assertSecurityHeaders(worker, protectedOrigin + '/sw.js');
  assert.match(worker.headers.get('content-type') ?? '', /javascript/i);
  assert.ok((await worker.text()).length > 0, 'protected service worker must not be empty');
  protectedChecks.push('/sw.js');

  const pdf = await request(fetchImpl, protectedOrigin, ESSAY_PDF_PATH);
  assertSecurityHeaders(pdf, protectedOrigin + ESSAY_PDF_PATH);
  assert.match(pdf.headers.get('content-type') ?? '', /application\/pdf/i);
  const pdfPrefix = Buffer.from(await pdf.arrayBuffer()).subarray(0, 5).toString('ascii');
  assert.equal(pdfPrefix, '%PDF-', 'essay route must serve the PDF, not the SPA fallback');
  protectedChecks.push(ESSAY_PDF_PATH);

  const demoHealth = await checkJsonApi(fetchImpl, demoOrigin, '/api/health');
  assert.deepEqual(demoHealth.body, { ok: true });
  demoChecks.push('/api/health');

  const demoReady = await checkJsonApi(fetchImpl, demoOrigin, '/api/ready');
  assert.equal(demoReady.body.ok, true, 'demo /api/ready must report ok=true');
  demoChecks.push('/api/ready');

  const demoAvailability = await checkJsonApi(fetchImpl, demoOrigin, '/api/public-demo');
  assert.deepEqual(demoAvailability.body, {
    available: true,
    selfServe: true,
    entryUrl: '/demo',
  });
  demoChecks.push('/api/public-demo');

  const demoEntry = await request(fetchImpl, demoOrigin, '/demo');
  assertSecurityHeaders(demoEntry, demoOrigin + '/demo');
  assert.match(demoEntry.headers.get('content-type') ?? '', /text\/html/i);
  const demoHtml = await demoEntry.text();
  assert.match(demoHtml, /name="protocap-runtime-profile" content="demo"/);
  assert.match(
    demoHtml,
    new RegExp('name="protocap-public-origin" content="' + escapeRegex(protectedOrigin) + '"')
  );
  demoChecks.push('/demo');

  const demoManifest = await request(fetchImpl, demoOrigin, '/manifest.webmanifest');
  assertSecurityHeaders(demoManifest, demoOrigin + '/manifest.webmanifest');
  assertNoStore(demoManifest, demoOrigin + '/manifest.webmanifest');
  const demoManifestBody = await demoManifest.json();
  assert.equal(demoManifestBody.name, 'ShiftGuide démo');
  assert.equal(demoManifestBody.start_url, '/demo');
  demoChecks.push('/manifest.webmanifest');

  const demoWorker = await request(fetchImpl, demoOrigin, '/sw.js');
  assertSecurityHeaders(demoWorker, demoOrigin + '/sw.js');
  assertNoStore(demoWorker, demoOrigin + '/sw.js');
  const demoWorkerBody = await demoWorker.text();
  assert.match(demoWorkerBody, /caches\.keys\(\)/, 'demo worker must clear inherited caches');
  assert.doesNotMatch(demoWorkerBody, /fetch\s*\(/, 'demo worker must not define a navigation fetch fallback');
  demoChecks.push('/sw.js');

  for (const path of ['/', '/rapport']) {
    const redirected = await request(fetchImpl, demoOrigin, path, { status: 302, redirect: 'manual' });
    assertSecurityHeaders(redirected, demoOrigin + path);
    assertNoStore(redirected, demoOrigin + path);
    assert.equal(
      redirected.headers.get('location'),
      protectedOrigin + path,
      'demo ' + path + ' must redirect to the real ProtoCap origin'
    );
    demoChecks.push(path + ' -> protected');
  }

  const demoPdf = await request(fetchImpl, demoOrigin, ESSAY_PDF_PATH, { status: 404 });
  assertSecurityHeaders(demoPdf, demoOrigin + ESSAY_PDF_PATH);
  assert.match(demoPdf.headers.get('content-type') ?? '', /text\/plain/i);
  demoChecks.push(ESSAY_PDF_PATH + ' -> 404');

  const result = {
    protectedOrigin,
    demoOrigin,
    protectedChecks,
    demoChecks,
  };
  log('ProtoCap live smoke passed: ' + JSON.stringify(result));
  return result;
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
