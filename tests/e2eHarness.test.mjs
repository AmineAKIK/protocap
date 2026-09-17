import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  createE2eServerEnvironment,
  E2E_HARNESS_MARKER,
  replaceEnvironment,
} from '../scripts/e2e-server-harness.mjs';

test('synthetic E2E environment replaces inherited values and disables the provider', () => {
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

test('synthetic E2E environment is deterministic and contains no external provider configuration', () => {
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

test('Playwright starts one identifiable synthetic server and never reuses an existing process', async () => {
  const sentinel = 'sentinel-must-not-reach-the-provider';
  const previous = process.env.DEEPSEEK_API_KEY;
  process.env.DEEPSEEK_API_KEY = sentinel;

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
  } finally {
    if (previous === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = previous;
  }
});

test('CI poisons every browser run with provider sentinels', async () => {
  const workflow = await readFile(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');

  for (const script of [
    'test:e2e',
    'test:e2e:responsive',
    'test:e2e:browser-smoke',
    'test:e2e:a11y',
  ]) {
    const escapedScript = script.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(
      workflow,
      new RegExp(
        `run: npm run ${escapedScript}\\n\\s+env:\\n`
        + '\\s+DEEPSEEK_API_KEY: e2e-sentinel-must-not-be-used\\n'
        + '\\s+SG_SYSTEM_PROMPT: e2e-host-config-must-not-be-used',
      ),
    );
  }
});
