import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import { createServerApp } from '../server/app.mjs';
import { RAILWAY_INGRESS_TRUST } from '../server/ingressTrust.mjs';
import { DEFAULT_SHIFTGUIDE_URGENCES } from '../server/shiftGuideDefaults.mjs';
import { TEST_CELINE_ROUTING_SPEC } from './celineRoutingFixture.mjs';

const shiftGuideConfig = {
  modules: [
    {
      id: 'module_standard',
      title: 'Module standard',
      description: 'Ingress test',
      type: 'standard',
      actions: [{ id: 'action_1', text: 'Faire le contrôle' }],
    },
  ],
  lexique: [{ sigle: 'OC', definition: 'Ordre de conditionnement' }],
  urgences: DEFAULT_SHIFTGUIDE_URGENCES,
  systemPromptExtra: null,
};

async function withRailwayServer(run, options = {}) {
  const { app } = createServerApp({
    shiftGuideCode: 'access-code',
    shiftGuideConfig,
    celineRoutingSpec: TEST_CELINE_ROUTING_SPEC,
    ingressTrust: RAILWAY_INGRESS_TRUST,
    logger: { info() {}, warn() {}, error() {} },
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

async function wrongUnlock(baseUrl, headers = {}) {
  return fetch(`${baseUrl}/api/shiftguide/unlock`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify({ code: 'wrong' }),
  });
}

test('changing X-Forwarded-For cannot bypass Railway client rate limiting', async () => {
  await withRailwayServer(async (baseUrl) => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response = await wrongUnlock(baseUrl, {
        'X-Real-IP': '203.0.113.20',
        'X-Forwarded-For': `198.51.100.${attempt + 1}`,
      });
      assert.equal(response.status, 401);
    }

    const blocked = await wrongUnlock(baseUrl, {
      'X-Real-IP': '203.0.113.20',
      'X-Forwarded-For': '192.0.2.250',
    });
    assert.equal(blocked.status, 429);
  });
});

test('unlock rate limiting stays bounded across the old fixed-window reset boundary', async () => {
  let currentTime = 0;
  await withRailwayServer(async (baseUrl) => {
    const headers = { 'X-Real-IP': '203.0.113.40' };

    assert.equal((await wrongUnlock(baseUrl, headers)).status, 401);

    currentTime = 599_999;
    for (let attempt = 0; attempt < 9; attempt += 1) {
      assert.equal((await wrongUnlock(baseUrl, headers)).status, 401);
    }

    currentTime = 600_001;
    assert.equal((await wrongUnlock(baseUrl, headers)).status, 401);

    const blocked = await wrongUnlock(baseUrl, headers);
    assert.equal(blocked.status, 429);
    assert.equal(blocked.headers.get('retry-after'), '600');
  }, { now: () => currentTime });
});

test('distinct valid Railway client IPs keep distinct unlock buckets', async () => {
  await withRailwayServer(async (baseUrl) => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response = await wrongUnlock(baseUrl, { 'X-Real-IP': '203.0.113.30' });
      assert.equal(response.status, 401);
    }

    const otherClient = await wrongUnlock(baseUrl, { 'X-Real-IP': '203.0.113.31' });
    assert.equal(otherClient.status, 401);
  });
});

test('Railway HTTPS metadata still enables HSTS without Express trust proxy', async () => {
  await withRailwayServer(async (baseUrl) => {
    const secure = await fetch(`${baseUrl}/api/health`, {
      headers: { 'X-Forwarded-Proto': 'https' },
    });
    assert.equal(secure.status, 200);
    assert.equal(secure.headers.get('strict-transport-security'), 'max-age=31536000');

    const insecure = await fetch(`${baseUrl}/api/health`);
    assert.equal(insecure.status, 200);
    assert.equal(insecure.headers.get('strict-transport-security'), null);
  });
});
