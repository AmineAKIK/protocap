import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import { createServerApp } from '../server/app.mjs';
import { createReadinessSnapshot } from '../server/readiness.mjs';
import { DEFAULT_SHIFTGUIDE_URGENCES } from '../server/shiftGuideDefaults.mjs';
import { TEST_CELINE_ROUTING_SPEC } from './celineRoutingFixture.mjs';

const shiftGuideConfig = {
  modules: [
    {
      id: 'module_standard',
      title: 'Module standard',
      description: 'Readiness test',
      type: 'standard',
      actions: [{ id: 'action_1', text: 'Faire le contrôle' }],
    },
  ],
  lexique: [{ sigle: 'OC', definition: 'Ordre de conditionnement' }],
  urgences: DEFAULT_SHIFTGUIDE_URGENCES,
  systemPromptExtra: null,
};

async function withServer(options, run) {
  const { app } = createServerApp({
    shiftGuideCode: 'access-code',
    shiftGuideConfig,
    celineRoutingSpec: TEST_CELINE_ROUTING_SPEC,
    logger: { error() {} },
    ...options,
  });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    await run(baseUrl);
  } finally {
    server.close();
    await once(server, 'close');
  }
}

test('readiness snapshot exposes only capability booleans', () => {
  const snapshot = createReadinessSnapshot({
    shiftGuideCode: 'secret',
    shiftGuideClientData: {},
    configRevision: 'sha256:config',
    celineAuthorityRevision: 'sha256:authority',
    celineSystemPrompt: 'prompt',
    celineAuthority: {},
    celineProvider: { complete() {} },
  });

  assert.deepEqual(snapshot, {
    ok: true,
    checks: {
      shiftGuide: true,
      celine: true,
    },
  });
  assert.doesNotMatch(JSON.stringify(snapshot), /secret|prompt|sha256/);
});

test('liveness stays healthy while readiness reports an unconfigured Celine provider', async () => {
  await withServer({ celineProvider: null }, async (baseUrl) => {
    const health = await fetch(`${baseUrl}/api/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { ok: true });

    const ready = await fetch(`${baseUrl}/api/ready`);
    assert.equal(ready.status, 503);
    assert.deepEqual(await ready.json(), {
      ok: false,
      checks: {
        shiftGuide: true,
        celine: false,
      },
    });
  });
});

test('readiness succeeds when ShiftGuide and Celine bootstrap capabilities are present', async () => {
  const celineProvider = { async complete() { return '{"kind":"unknown"}'; } };
  await withServer({ celineProvider }, async (baseUrl) => {
    const ready = await fetch(`${baseUrl}/api/ready`);
    assert.equal(ready.status, 200);
    assert.deepEqual(await ready.json(), {
      ok: true,
      checks: {
        shiftGuide: true,
        celine: true,
      },
    });
  });
});

test('readiness fails when ShiftGuide itself is not configured', async () => {
  const celineProvider = { async complete() { return '{"kind":"unknown"}'; } };
  await withServer({ shiftGuideCode: '', celineProvider }, async (baseUrl) => {
    const ready = await fetch(`${baseUrl}/api/ready`);
    assert.equal(ready.status, 503);
    assert.deepEqual(await ready.json(), {
      ok: false,
      checks: {
        shiftGuide: false,
        celine: false,
      },
    });
  });
});
