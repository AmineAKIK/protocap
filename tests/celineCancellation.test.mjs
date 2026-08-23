import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import test from 'node:test';
import { createServerApp, createServerRuntimeState } from '../server/app.mjs';
import { CelineProviderError } from '../server/providers/deepSeekProvider.mjs';
import { DEFAULT_SHIFTGUIDE_URGENCES } from '../server/shiftGuideDefaults.mjs';
import { TEST_CELINE_ROUTING_SPEC } from './celineRoutingFixture.mjs';

const shiftGuideConfig = {
  modules: [
    {
      id: 'module_standard',
      title: 'Module standard',
      description: 'Test HTTP',
      type: 'standard',
      actions: [{ id: 'action_1', text: 'Faire le contrôle' }],
    },
  ],
  lexique: [{ sigle: 'OC', definition: 'Ordre de conditionnement' }],
  urgences: DEFAULT_SHIFTGUIDE_URGENCES,
  systemPromptExtra: null,
};

async function listen(app) {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
    port: address.port,
  };
}

async function unlock(baseUrl) {
  const response = await fetch(`${baseUrl}/api/shiftguide/unlock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'access-code' }),
  });
  assert.equal(response.status, 200);
  return response.json();
}

test('client disconnect aborts in-flight Celine provider work without persisting context or logging a provider failure', async () => {
  const runtimeState = createServerRuntimeState();
  const errors = [];
  let providerStartedResolve;
  let providerCancelledResolve;
  const providerStarted = new Promise((resolve) => {
    providerStartedResolve = resolve;
  });
  const providerCancelled = new Promise((resolve) => {
    providerCancelledResolve = resolve;
  });

  const celineProvider = {
    async complete({ signal }) {
      providerStartedResolve();
      return new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => {
          providerCancelledResolve();
          reject(new CelineProviderError('cancelled', 'client disconnected'));
        }, { once: true });
      });
    },
  };

  const { app } = createServerApp({
    shiftGuideCode: 'access-code',
    shiftGuideConfig,
    celineRoutingSpec: TEST_CELINE_ROUTING_SPEC,
    celineProvider,
    runtimeState,
    issueToken: () => 'cancel-test-token',
    logger: { error(...args) { errors.push(args); } },
  });
  const { server, baseUrl, port } = await listen(app);

  try {
    const unlocked = await unlock(baseUrl);
    assert.equal(unlocked.token, 'cancel-test-token');

    const body = JSON.stringify({ messages: [{ role: 'user', content: 'bonjour' }] });
    const request = http.request({
      host: '127.0.0.1',
      port,
      path: '/api/celine/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        Authorization: `Bearer ${unlocked.token}`,
      },
    });
    request.on('error', () => {});
    request.end(body);

    await providerStarted;
    request.destroy();
    await providerCancelled;
    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(runtimeState.celineContexts.has(unlocked.token), false);
    assert.deepEqual(errors, []);
  } finally {
    server.close();
    await once(server, 'close');
  }
});
