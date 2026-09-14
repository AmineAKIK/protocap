import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function read(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

function registeredRoutes(registry) {
  return [...registry.matchAll(/route:\s*'([^']+)'/g)].map((match) => match[1]);
}

function appPrincipalRoutes(app) {
  return [...app.matchAll(/<Route\s+path="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((route) => route !== '*' && route !== '/shiftguide/*');
}

function shiftGuidePrincipalRoutes(app) {
  return [...app.matchAll(/<Route\s+path="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((route) => !['*', 'home', 'modules'].includes(route))
    .map((route) => `/shiftguide/${route}`);
}

test('every principal routed surface is registered for responsive coverage', async () => {
  const [app, shiftGuideApp, registry] = await Promise.all([
    read('src/App.tsx'),
    read('src/features/shiftguide/ShiftGuideApp.tsx'),
    read('src/responsive/surfaceRegistry.ts'),
  ]);

  const expected = new Set([
    '/',
    ...appPrincipalRoutes(app),
    '/shiftguide',
    ...shiftGuidePrincipalRoutes(shiftGuideApp),
  ]);
  const registered = new Set(registeredRoutes(registry));

  assert.deepEqual([...registered].sort(), [...expected].sort());
});

test('registered surfaces declare a concrete responsive contract', async () => {
  const registry = await read('src/responsive/surfaceRegistry.ts');
  const entries = [...registry.matchAll(/\{ id: '([^']+)', route: '([^']+)', coverage: '([^']+)', contractRef: '([^']+)' \}/g)];

  assert.ok(entries.length >= 10, 'principal surfaces must remain explicitly registered');
  for (const [, id, route, coverage, contractRef] of entries) {
    assert.ok(id && route && contractRef);
    assert.ok(['browser-contract', 'specialized-contract'].includes(coverage), `${route} has invalid coverage ${coverage}`);
  }
});
