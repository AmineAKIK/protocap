import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  createE2eServerEnvironment,
  E2E_HARNESS_MARKER,
  replaceEnvironment,
} from '../scripts/e2e-server-harness.mjs';
import { E2E_SUITES } from '../scripts/e2e-suites.mjs';

test('T29/T39: synthetic E2E environment replaces inherited values and disables the provider', () => {
  const inherited = {
    PATH: '/host/bin',
    DEEPSEEK_API_KEY: 'sentinel-must-not-survive',
    SG_SYSTEM_PROMPT: 'protected-host-configuration',
    UNRELATED_SECRET: 'host-only',
  };

  replaceEnvironment(inherited, createE2eServerEnvironment());

  assert.deepEqual(inherited, createE2eServerEnvironment());
  assert.equal(inherited[E2E_HARNESS_MARKER], '1');
  assert.equal(inherited.DEEPSEEK_API_KEY, '');
  assert.equal(Object.hasOwn(inherited, 'SG_SYSTEM_PROMPT'), false);
  assert.equal(Object.hasOwn(inherited, 'UNRELATED_SECRET'), false);
});

test('T29/T39: synthetic E2E environment is deterministic and contains no external provider configuration', () => {
  const first = createE2eServerEnvironment();
  const second = createE2eServerEnvironment();

  assert.deepEqual(first, second);
  assert.notEqual(first, second);
  assert.equal(first.NODE_ENV, 'test');
  assert.equal(first.TZ, 'UTC');
  assert.equal(first.PORT, '4173');
  assert.equal(first.DEEPSEEK_API_KEY, '');
  assert.ok(JSON.parse(first.SG_MODULES).length > 0);
  assert.ok(JSON.parse(first.SG_CELINE_ROUTING).routes.length > 0);
});

test('T39: Playwright starts one identifiable synthetic server and never reuses an existing process', async () => {
  const sentinel = 'sentinel-must-not-reach-the-provider';
  const previousKey = process.env.DEEPSEEK_API_KEY;
  const previousCi = process.env.CI;
  const previousSuite = process.env.PLAYWRIGHT_SUITE;
  process.env.DEEPSEEK_API_KEY = sentinel;
  process.env.CI = '1';
  process.env.PLAYWRIGHT_SUITE = 'policy-test';

  try {
    const { default: config } = await import(`../playwright.config.ts?harness=${Date.now()}`);
    const webServer = Array.isArray(config.webServer) ? config.webServer[0] : config.webServer;

    assert.ok(webServer);
    assert.equal(webServer.command, 'node scripts/e2e-server-harness.mjs');
    assert.equal(webServer.reuseExistingServer, false);
    assert.deepEqual(webServer.env, {
      [E2E_HARNESS_MARKER]: '1',
      DEEPSEEK_API_KEY: '',
    });
    assert.deepEqual(webServer.gracefulShutdown, { signal: 'SIGTERM', timeout: 5_000 });
    assert.equal(Object.values(webServer.env).includes(sentinel), false);

    assert.equal(config.retries, 1);
    assert.equal(config.failOnFlakyTests, true);
    assert.equal(config.outputDir, 'test-results/playwright/policy-test');
    assert.equal(config.use.trace, 'retain-on-failure');
    assert.equal(config.use.screenshot, 'only-on-failure');
    assert.equal(config.use.video, 'retain-on-failure');
    assert.ok(config.reporter.some(([name]) => name === 'json'));
    assert.ok(config.reporter.some(([name]) => name === 'html'));
  } finally {
    if (previousKey === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = previousKey;
    if (previousCi === undefined) delete process.env.CI;
    else process.env.CI = previousCi;
    if (previousSuite === undefined) delete process.env.PLAYWRIGHT_SUITE;
    else process.env.PLAYWRIGHT_SUITE = previousSuite;
  }
});

test('T39: public-demo Playwright config starts both origins without process reuse', async () => {
  const previousCi = process.env.CI;
  process.env.CI = '1';
  try {
    const { default: config } = await import(`../playwright.public-demo.config.ts?harness=${Date.now()}`);
    assert.ok(Array.isArray(config.webServer));
    assert.equal(config.webServer.length, 2);
    for (const server of config.webServer) {
      assert.equal(server.reuseExistingServer, false);
      assert.deepEqual(server.gracefulShutdown, { signal: 'SIGTERM', timeout: 5_000 });
      assert.equal(server.env.DEEPSEEK_API_KEY, '');
    }
    assert.equal(config.failOnFlakyTests, true);
  } finally {
    if (previousCi === undefined) delete process.env.CI;
    else process.env.CI = previousCi;
  }
});

test('T29/T38: CI poisons every protected browser run and isolates the public demo', async () => {
  const workflow = await readFile(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');

  for (const suite of Object.values(E2E_SUITES).filter(({ script }) => script !== 'test:e2e:public-demo')) {
    const escapedScript = suite.script.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(
      workflow,
      new RegExp(
        `run: npm run ${escapedScript}\\n\\s+env:\\n`
        + '\\s+DEEPSEEK_API_KEY: e2e-sentinel-must-not-be-used\\n'
        + '\\s+SG_SYSTEM_PROMPT: e2e-host-config-must-not-be-used',
      ),
    );
  }

  assert.match(
    workflow,
    /run: npm run test:e2e:public-demo\n\s+env:\n\s+DEEPSEEK_API_KEY: ''\n\s+SG_SYSTEM_PROMPT: public-demo-host-config-must-not-be-used/,
  );
});
