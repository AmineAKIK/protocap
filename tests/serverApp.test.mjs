import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import { createServerApp } from '../server/app.mjs';
import { CelineProviderError } from '../server/providers/deepSeekProvider.mjs';
import { DEFAULT_SHIFTGUIDE_URGENCES } from '../server/shiftGuideDefaults.mjs';

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

async function chat(baseUrl, token, messages = [{ role: 'user', content: 'bonjour' }]) {
  return fetch(`${baseUrl}/api/celine/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ messages }),
  });
}

test('Express factory supports the real unlock, session and logout lifecycle over HTTP', async () => {
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
    assert.equal(unlocked.modules[0].id, 'module_standard');

    const session = await fetch(`${baseUrl}/api/shiftguide/session`, {
      headers: { Authorization: `Bearer ${unlocked.token}` },
    });
    assert.equal(session.status, 200);
    const sessionBody = await session.json();
    assert.equal(sessionBody.ok, true);
    assert.equal(typeof sessionBody.expiresAt, 'number');
    assert.equal(sessionBody.configRevision, unlocked.configRevision);

    const logout = await fetch(`${baseUrl}/api/shiftguide/session`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${unlocked.token}` },
    });
    assert.equal(logout.status, 204);

    const revoked = await fetch(`${baseUrl}/api/shiftguide/session`, {
      headers: { Authorization: `Bearer ${unlocked.token}` },
    });
    assert.equal(revoked.status, 401);
  });
});

test('Celine HTTP route renders operator content from server authority, not provider prose', async () => {
  let providerRequest;
  const celineProvider = {
    async complete(input) {
      providerRequest = input;
      return JSON.stringify({ kind: 'route', id: 'module:module_standard' });
    },
  };

  await withServer({ celineProvider }, async (baseUrl) => {
    const unlocked = await unlock(baseUrl);
    const response = await chat(baseUrl, unlocked.token);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      message: 'Suis la séquence « Module standard » dans l’ordre indiqué.',
      checklist: [
        { actionId: 'action_1', text: 'Faire le contrôle', note: null, module: 'Module standard' },
      ],
      followUp: 'Dis-moi quand la checklist est traitée.',
    });
    assert.equal(providerRequest.history[0].content, 'bonjour');
    assert.match(providerRequest.systemPrompt, /module:module_standard/);
    assert.doesNotMatch(providerRequest.systemPrompt, /Faire le contrôle/);
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

test('Celine HTTP route rejects free-form output and unauthorized decisions', async () => {
  for (const providerContent of [
    JSON.stringify({
      kind: 'route',
      id: 'module:module_standard',
      message: 'Instruction libre injectée par le fournisseur',
    }),
    JSON.stringify({ kind: 'route', id: 'route_inventee' }),
  ]) {
    const invalidProvider = { async complete() { return providerContent; } };
    await withServer({ celineProvider: invalidProvider }, async (baseUrl) => {
      const unlocked = await unlock(baseUrl);
      const response = await chat(baseUrl, unlocked.token);
      assert.equal(response.status, 502);
      assert.deepEqual(await response.json(), { error: 'Service IA indisponible.' });
    });
  }
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
