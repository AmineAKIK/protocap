import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

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

  assert.equal(packageJson.scripts['audit:prod'], 'npm audit --omit=dev');
  assert.match(workflow, /run:\s+npm run audit:prod/);
});

test('browser quality gate keeps desktop journeys focused and adds cross-browser accessibility smoke coverage', async () => {
  const packageJson = JSON.parse(await read('package.json'));
  const playwright = await read('playwright.config.ts');
  const workflow = await read('.github/workflows/ci.yml');
  const accessibility = await read('e2e/accessibility.spec.ts');

  assert.equal(packageJson.devDependencies['@axe-core/playwright'], '4.13.0');
  assert.match(packageJson.scripts['test:e2e'], /--project=chromium/);
  assert.match(packageJson.scripts['test:e2e:browser-smoke'], /--project=chromium-mobile/);
  assert.match(packageJson.scripts['test:e2e:browser-smoke'], /--project=webkit/);
  assert.match(packageJson.scripts['test:e2e:a11y'], /accessibility\.spec\.ts --project=chromium/);

  assert.match(playwright, /name:\s*'chromium-mobile'/);
  assert.match(playwright, /devices\['Pixel 7'\]/);
  assert.match(playwright, /name:\s*'webkit'/);
  assert.match(playwright, /devices\['Desktop Safari'\]/);

  assert.match(workflow, /playwright install --with-deps chromium webkit/);
  assert.match(workflow, /run:\s+npm run test:e2e:browser-smoke/);
  assert.match(workflow, /run:\s+npm run test:e2e:a11y/);
  assert.match(accessibility, /new AxeBuilder/);
  assert.match(accessibility, /violation\.impact === 'critical' \|\| violation\.impact === 'serious'/);
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
