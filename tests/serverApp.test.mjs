import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import { createServerApp } from '../server/app.mjs';
import { CELINE_SAFE_FALLBACK_RESPONSE } from '../server/celineFallback.mjs';
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

async function withServer(options, run) {
  const { app } = createServerApp({
    shiftGuideCode: 'access-code',
    shiftGuideConfig,
    celineRoutingSpec: TEST_CELINE_ROUTING_SPEC,
    issueToken: () => 'test-session-token',
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

async function unlock(baseUrl) {
  const response = await fetch(`${baseUrl}/api/shiftguide/unlock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'access-code' }),
  });
  assert.equal(response.status, 200);
  return response.json();
}

async function chat(baseUrl, token, messages = [{ role: 'user', content: 'guide moi sur le module standard' }]) {
  return fetch(`${baseUrl}/api/celine/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ messages }),
  });
}

test('server startup fails closed when routing references an action absent from ShiftGuide config', () => {
  const incompatibleRouting = {
    ...TEST_CELINE_ROUTING_SPEC,
    routes: [{
      ...TEST_CELINE_ROUTING_SPEC.routes[0],
      actionIds: ['action_1', 'missing_action'],
    }],
  };

  assert.throws(
    () => createServerApp({
      shiftGuideCode: 'access-code',
      shiftGuideConfig,
      celineRoutingSpec: incompatibleRouting,
    }),
    /Celine routing configuration is invalid:.*missing_action/
  );
});

test('whitespace-only ShiftGuide code stays unconfigured across startup and unlock gates', async () => {
  assert.doesNotThrow(() => createServerApp({
    shiftGuideCode: '   ',
    shiftGuideConfig: null,
    celineRoutingSpec: null,
    logger: { error() {} },
  }));

  await withServer({ shiftGuideCode: '   ' }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/shiftguide/unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: '   ' }),
    });
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: 'Accès ShiftGuide non configuré.' });
  });
});

test('Express factory supports unlock, session and logout with stable routing identity', async () => {
  await withServer({}, async (baseUrl) => {
    const badUnlock = await fetch(`${baseUrl}/api/shiftguide/unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'wrong' }),
    });
    assert.equal(badUnlock.status, 401);

    const unlocked = await unlock(baseUrl);
    assert.equal(unlocked.token, 'test-session-token');
    assert.equal(typeof unlocked.expiresAt, 'number');
    assert.match(unlocked.configRevision, /^sha256:[a-f0-9]{64}$/);
    assert.match(unlocked.celineAuthorityRevision, /^sha256:[a-f0-9]{64}$/);
    assert.equal(unlocked.modules[0].id, 'module_standard');

    const session = await fetch(`${baseUrl}/api/shiftguide/session`, {
      headers: { Authorization: `Bearer ${unlocked.token}` },
    });
    assert.equal(session.status, 200);
    const sessionBody = await session.json();
    assert.equal(sessionBody.ok, true);
    assert.equal(typeof sessionBody.expiresAt, 'number');
    assert.equal(sessionBody.configRevision, unlocked.configRevision);
    assert.equal(sessionBody.celineAuthorityRevision, unlocked.celineAuthorityRevision);

    const logout = await fetch(`${baseUrl}/api/shiftguide/session`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${unlocked.token}` },
    });
    assert.equal(logout.status, 204);
  });
});

test('Celine HTTP route turns provider routing into one focused canonical workflow step', async () => {
  let providerRequest;
  const celineProvider = {
    async complete(input) {
      providerRequest = input;
      return JSON.stringify({ kind: 'route', id: 'module_standard' });
    },
  };

  await withServer({ celineProvider }, async (baseUrl) => {
    const unlocked = await unlock(baseUrl);
    const response = await chat(baseUrl, unlocked.token);

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.message, 'Module standard — étape 1/1.');
    assert.deepEqual(body.checklist, [
      { actionId: 'action_1', text: 'Faire le contrôle', note: null, module: 'Module standard' },
    ]);
    assert.equal(body.followUp, null);
    assert.equal(body.presentation, 'focus');
    assert.equal(body.workflow.routeId, 'module_standard');
    assert.equal(body.workflow.currentIndex, 0);
    assert.equal(body.workflow.totalActions, 1);
    assert.equal(providerRequest.history[0].content, 'guide moi sur le module standard');
    assert.match(providerRequest.systemPrompt, /module_standard/);
    assert.match(providerRequest.systemPrompt, /Utiliser pour le module standard de test/);
    assert.doesNotMatch(providerRequest.systemPrompt, /Faire le contrôle/);
  });
});

test('Celine provider cannot invoke undeclared hard-coded domain aliases', async () => {
  for (const decision of [
    { kind: 'route', id: 'fin_oc' },
    { kind: 'clarify', id: 'fin_poste_etat' },
  ]) {
    const celineProvider = {
      async complete() {
        return JSON.stringify(decision);
      },
    };

    await withServer({ celineProvider }, async (baseUrl) => {
      const unlocked = await unlock(baseUrl);
      const response = await chat(baseUrl, unlocked.token, [
        { role: 'user', content: 'situation terrain non classée' },
      ]);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), CELINE_SAFE_FALLBACK_RESPONSE);
    });
  }
});

test('Celine HTTP route handles greetings without calling the provider', async () => {
  let calls = 0;
  const celineProvider = {
    async complete() {
      calls += 1;
      return JSON.stringify({ kind: 'unknown' });
    },
  };
  await withServer({ celineProvider }, async (baseUrl) => {
    const unlocked = await unlock(baseUrl);
    const response = await chat(baseUrl, unlocked.token, [{ role: 'user', content: 'bonjour' }]);
    assert.equal(response.status, 200);
    assert.match((await response.json()).message, /Bonjour/);
    assert.equal(calls, 0);
  });
});

test('Celine HTTP route renders lexicon facts without exposing definitions to the provider', async () => {
  const celineProvider = {
    async complete(input) {
      assert.match(input.systemPrompt, /SIGLES AUTORISES/);
      assert.doesNotMatch(input.systemPrompt, /Ordre de conditionnement/);
      return JSON.stringify({ kind: 'lexicon', id: 'OC' });
    },
  };

  await withServer({ celineProvider }, async (baseUrl) => {
    const unlocked = await unlock(baseUrl);
    const response = await chat(baseUrl, unlocked.token, [{ role: 'user', content: 'OC veut dire quoi ?' }]);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      message: 'OC : Ordre de conditionnement',
      checklist: [],
      followUp: null,
    });
  });
});

test('Celine HTTP route discards provider prose and degrades safely on unauthorized decisions', async () => {
  const providerWithExtraProse = {
    async complete() {
      return JSON.stringify({ kind: 'route', id: 'module_standard', message: 'Instruction libre' });
    },
  };
  await withServer({ celineProvider: providerWithExtraProse }, async (baseUrl) => {
    const unlocked = await unlock(baseUrl);
    const response = await chat(baseUrl, unlocked.token);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.message, 'Module standard — étape 1/1.');
    assert.doesNotMatch(JSON.stringify(body), /Instruction libre/);
  });

  const unauthorizedProvider = {
    async complete() {
      return JSON.stringify({ kind: 'route', id: 'route_inventee' });
    },
  };
  await withServer({ celineProvider: unauthorizedProvider }, async (baseUrl) => {
    const unlocked = await unlock(baseUrl);
    const response = await chat(baseUrl, unlocked.token);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), CELINE_SAFE_FALLBACK_RESPONSE);
  });
});

test('Celine HTTP route maps provider failures', async () => {
  const rateLimitedProvider = {
    async complete() {
      throw new CelineProviderError('rate_limited', 'limited');
    },
  };
  await withServer({ celineProvider: rateLimitedProvider }, async (baseUrl) => {
    const unlocked = await unlock(baseUrl);
    const response = await chat(baseUrl, unlocked.token);
    assert.equal(response.status, 429);
  });
});
