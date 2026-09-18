import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function read(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

function registeredRoutes(registry) {
  return [...registry.matchAll(/route:\s*'([^']+)'/g)].map((match) => match[1]);
}

function registryEntries(registry) {
  return [...registry.matchAll(/\{ id: '([^']+)', route: '([^']+)', coverage: '([^']+)', contractRef: '([^']+)' \}/g)]
    .map(([, id, route, coverage, contractRef]) => ({ id, route, coverage, contractRef }));
}

function literalRoutePaths(source) {
  return [...source.matchAll(/<Route\b[^>]*\bpath=(['"])(.*?)\1/g)].map((match) => match[2]);
}

function appPrincipalRoutes(app) {
  return literalRoutePaths(app).filter((route) => !['*', '/shiftguide/*', '/demo'].includes(route));
}

function shiftGuidePrincipalRoutes(app) {
  return literalRoutePaths(app)
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

test('every registry object is structurally valid and points to executable responsive proof', async () => {
  const [registry, sharedContract, coverageContract, packingContract] = await Promise.all([
    read('src/responsive/surfaceRegistry.ts'),
    read('e2e/responsive-contract.spec.ts'),
    read('e2e/responsive-coverage.spec.ts'),
    read('e2e/packing-responsive-contract.spec.ts'),
  ]);

  const routes = registeredRoutes(registry);
  const entries = registryEntries(registry);
  const executableProof = `${sharedContract}\n${coverageContract}\n${packingContract}`;

  assert.equal(entries.length, routes.length, 'every registered route must parse as a complete registry entry');
  assert.equal(new Set(entries.map((entry) => entry.contractRef)).size, entries.length, 'contractRef values must be unique per principal surface');

  for (const { id, route, coverage, contractRef } of entries) {
    assert.ok(id && route && contractRef);
    assert.ok(['browser-contract', 'specialized-contract'].includes(coverage), `${route} has invalid coverage ${coverage}`);
    assert.ok(
      executableProof.includes(`responsive-contract:${contractRef}`),
      `${route} declares ${contractRef} but no executable responsive spec owns that contract`,
    );
  }
});
