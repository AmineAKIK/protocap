import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { E2E_SUITES } from '../scripts/e2e-suites.mjs';

async function read(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('GitHub Actions dependencies are pinned to immutable commit SHAs', async () => {
  for (const workflow of [
    '.github/workflows/ci.yml',
    '.github/workflows/codeql.yml',
    '.github/workflows/live-smoke.yml',
  ]) {
    const content = await read(workflow);
    const usesLines = content.split('\n').filter((line) => line.trim().startsWith('uses:'));
    assert.ok(usesLines.length > 0, `${workflow} must use at least one action`);
    for (const line of usesLines) {
      assert.match(line, /^\s*uses:\s+[^@\s]+@[0-9a-f]{40}(?:\s+#.*)?$/, `${workflow} action must be SHA-pinned: ${line}`);
    }
  }
});

test('CodeQL scans JavaScript and TypeScript with minimal explicit permissions', async () => {
  const workflow = await read('.github/workflows/codeql.yml');

  assert.match(workflow, /languages:\s+javascript-typescript/);
  assert.match(workflow, /build-mode:\s+none/);
  assert.match(workflow, /permissions:\n\s+contents:\s+read\n\s+security-events:\s+write/);
  assert.doesNotMatch(workflow, /permissions:\s+write-all/);
});

test('production dependency audit is a named repository script wired into CI', async () => {
  const packageJson = JSON.parse(await read('package.json'));
  const workflow = await read('.github/workflows/ci.yml');

  assert.equal(packageJson.scripts['audit:prod'], 'npm audit --omit=dev --audit-level=low');
  assert.match(workflow, /run:\s+npm run audit:prod/);
});

test('browser quality gate keeps desktop journeys focused and adds cross-browser accessibility smoke coverage', async () => {
  const packageJson = JSON.parse(await read('package.json'));
  const playwright = await read('playwright.config.ts');
  const workflow = await read('.github/workflows/ci.yml');
  const accessibility = await read('e2e/accessibility.spec.ts');
  const packing = await read('e2e/packing-calculator.spec.ts');
  const browserSmoke = await read('e2e/browser-smoke.spec.ts');

  assert.equal(packageJson.devDependencies['@axe-core/playwright'], '4.13.0');
  assert.deepEqual(E2E_SUITES.critical.projects, ['chromium']);
  assert.ok(E2E_SUITES.critical.specs.includes('e2e/packing-calculator.spec.ts'));
  assert.deepEqual(E2E_SUITES['browser-smoke'].projects, ['chromium-mobile', 'webkit']);
  assert.deepEqual(E2E_SUITES.accessibility.projects, ['chromium']);
  assert.deepEqual(E2E_SUITES.accessibility.specs, ['e2e/accessibility.spec.ts']);

  assert.match(playwright, /name:\s*'chromium-mobile'/);
  assert.match(playwright, /devices\['Pixel 7'\]/);
  assert.match(playwright, /name:\s*'webkit'/);
  assert.match(playwright, /devices\['Desktop Safari'\]/);
  assert.match(playwright, /failOnFlakyTests:\s*ci/);
  assert.match(playwright, /trace:\s*'retain-on-failure'/);

  assert.match(workflow, /playwright install --with-deps chromium webkit/);
  assert.match(workflow, /run:\s+npm run test:e2e:browser-smoke/);
  assert.match(workflow, /run:\s+npm run test:e2e:a11y/);
  assert.match(accessibility, /new AxeBuilder/);
  assert.match(accessibility, /Packing Calculator filled workshop state/);
  assert.match(accessibility, /setViewportSize\(\{ width: 1366, height: 768 \}\)/);
  assert.match(accessibility, /violation\.impact === 'critical' \|\| violation\.impact === 'serious'/);
  assert.match(packing, /1366/);
  assert.match(packing, /1920/);
  assert.match(packing, /expectNoHorizontalOverflow/);
  assert.match(packing, /businessNumbers\.count\(\)/);
  assert.match(packing, /keyboard\.press\('Space'\)/);
  assert.match(browserSmoke, /Packing Calculator keeps its primary declaration action usable/);
});

test('responsive architecture contract is a named CI quality gate backed by a shared viewport harness', async () => {
  const workflow = await read('.github/workflows/ci.yml');
  const harness = await read('e2e/responsive-harness.ts');
  const contract = await read('e2e/responsive-contract.spec.ts');
  const architecture = await read('docs/responsive-architecture.md');

  assert.deepEqual(E2E_SUITES.responsive.projects, ['chromium']);
  assert.ok(E2E_SUITES.responsive.specs.includes('e2e/responsive-contract.spec.ts'));
  assert.ok(E2E_SUITES.responsive.specs.includes('e2e/packing-responsive-contract.spec.ts'));
  assert.match(workflow, /Run responsive architecture contract/);
  assert.match(workflow, /run:\s+npm run test:e2e:responsive/);
  assert.match(harness, /phoneMin:.*width:\s*320,\s*height:\s*568/);
  assert.match(harness, /phoneLandscape:.*width:\s*844,\s*height:\s*390/);
  assert.match(harness, /expectNoDocumentHorizontalOverflow/);
  assert.match(harness, /expectPrimaryActionUsable/);
  assert.match(contract, /CORE_RESPONSIVE_MATRIX/);
  assert.match(contract, /proposition-pilote/);
  assert.match(contract, /shiftguide\/module\/module_standard/);
  assert.match(architecture, /responsiveness as an application invariant/);
  assert.match(architecture, /Definition of done for a new page/);
});

test('scheduled live smoke remains read-only, secret-free and outside AI/auth routes', async () => {
  const packageJson = JSON.parse(await read('package.json'));
  const workflow = await read('.github/workflows/live-smoke.yml');
  const smoke = await read('scripts/live-smoke.mjs');

  assert.equal(packageJson.scripts['smoke:live'], 'node scripts/live-smoke.mjs');
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /cron:\s*'17 6 \* \* \*'/);
  assert.match(workflow, /permissions:\n\s+contents:\s+read/);
  assert.match(workflow, /PROTOCAP_BASE_URL:\s+https:\/\/protocap-production\.up\.railway\.app/);
  assert.match(workflow, /run:\s+npm run smoke:live/);
  assert.doesNotMatch(workflow, /secrets\./);
  assert.doesNotMatch(workflow, /permissions:\s+write-all/);

  for (const safePath of ['/', '/api/health', '/api/ready', '/robots.txt']) {
    assert.ok(smoke.includes(`'${safePath}'`), `live smoke must include ${safePath}`);
  }
  assert.doesNotMatch(smoke, /\/api\/shiftguide\/unlock/);
  assert.doesNotMatch(smoke, /\/api\/shiftguide\/session/);
  assert.doesNotMatch(smoke, /\/api\/celine\/chat/);
});
