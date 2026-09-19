import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const visibleIdentitySurfaces = [
  'index.html',
  'vite.config.ts',
  'src/components/AppShell.tsx',
  'src/pages/HomePage.tsx',
  'src/pages/OperationalReportPage.tsx',
  'src/pages/shiftguide/ShiftGuideHome.tsx',
  'src/pages/shiftguide/ShiftGuideLock.tsx',
  'README.md',
];

test('T35: ProtoCap is canonical on visible product surfaces while historical storage keys remain untouched', async () => {
  const packageJson = JSON.parse(await read('package.json'));
  assert.equal(packageJson.name, 'protocap');

  const surfaces = await Promise.all(visibleIdentitySurfaces.map(async (path) => [path, await read(path)]));
  for (const [surface, content] of surfaces) {
    assert.doesNotMatch(content, /LineOps Toolkit/, `${surface} must not expose the retired product name`);
    if (surface !== 'src/pages/shiftguide/ShiftGuideLock.tsx') {
      assert.match(content, /ProtoCap/, `${surface} must expose the canonical ProtoCap identity`);
    }
  }

  assert.doesNotMatch(
    (await read('src/pages/shiftguide/ShiftGuideHome.tsx')),
    />LineOps</,
    'ShiftGuide cockpit must not expose the retired LineOps label',
  );

  const persistence = await Promise.all([
    read('src/features/expiry/persistence.ts'),
    read('src/features/logistics/logisticsPersistence.ts'),
    read('src/features/packing/persistence/packingRunStorage.ts'),
  ]);
  assert.ok(
    persistence.every((content) => content.includes('lineops.')),
    'historical lineops.* storage keys must remain stable unless a tested migration changes them',
  );
});

test('T36: current UI copy states local persistence and estimated validity without false delivery or authorization claims', async () => {
  const [logistics, expiry] = await Promise.all([
    read('src/pages/LogisticsCallPage.tsx'),
    read('src/pages/ExpiryCheckPage.tsx'),
  ]);

  assert.match(logistics, /enregistré localement|board local|état local/);
  assert.doesNotMatch(logistics, /sans perte d'information|envoyé au board logistique|demandes envoyées depuis les lignes/i);

  assert.match(expiry, /Validité estimée favorable/);
  assert.doesNotMatch(expiry, /Démarrage de la ligne autorisé|autorisation de démarrage/i);

  const expiryE2e = await read('e2e/expiry-time.spec.ts');
  assert.doesNotMatch(expiryE2e, /Démarrage de la ligne autorisé/i);

  const home = await read('src/pages/HomePage.tsx');
  assert.match(home, /Validité estimée, échéances visibles/);
  assert.doesNotMatch(home, /Démarrage sécurisé/);
});

test('T34/T37: portfolio entry distinguishes demonstration, evidence and unmeasured outcomes', async () => {
  const readme = await read('README.md');
  assert.match(readme, /Try ShiftGuide demo/);
  assert.match(readme, /fictitious fixtures and scripted responses/);
  assert.match(readme, /not evidence of an industrial deployment or measured business impact/i);
  assert.match(readme, /does \*\*not\*\* infer solo authorship/i);
  assert.match(readme, /Historical evidence is kept as history/i);
});
