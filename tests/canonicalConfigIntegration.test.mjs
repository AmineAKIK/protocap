import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import { createServerApp } from '../server/app.mjs';
import { DEFAULT_SHIFTGUIDE_URGENCES } from '../server/shiftGuideDefaults.mjs';

const cleanConfig = {
  modules: [{
    id: 'module_standard',
    title: 'Module standard',
    description: 'Canonical integration test',
    type: 'standard',
    actions: [{ id: 'action_1', text: 'Faire le contrôle' }],
  }],
  lexique: [{ sigle: 'OC', definition: 'Ordre de conditionnement' }],
  urgences: DEFAULT_SHIFTGUIDE_URGENCES,
  systemPromptExtra: null,
};

const cleanRouting = {
  version: 1,
  routes: [{
    id: 'module_standard',
    label: 'Module standard',
    decisionGuide: 'Utiliser pour le module standard.',
    actionIds: ['action_1'],
  }],
  clarifications: [{
    id: 'clarifier',
    question: 'Précise la situation.',
    decisionGuide: 'Utiliser si la situation manque.',
  }],
  classifierRules: ['Ne jamais supposer un état absent.'],
};

async function unlockSnapshot(shiftGuideConfig, celineRoutingSpec) {
  const { app } = createServerApp({
    shiftGuideCode: 'access-code',
    shiftGuideConfig,
    celineRoutingSpec,
    logger: { info() {}, warn() {}, error() {} },
  });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();

  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/shiftguide/unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'access-code' }),
    });
    assert.equal(response.status, 200);
    return response.json();
  } finally {
    server.close();
    await once(server, 'close');
  }
}

test('unknown deployment metadata neither leaks to unlock nor changes semantic revisions', async () => {
  const decoratedConfig = {
    ...cleanConfig,
    deploymentNote: 'must not cross the runtime boundary',
    modules: [{
      ...cleanConfig.modules[0],
      owner: 'ignored',
      actions: [{ ...cleanConfig.modules[0].actions[0], source: 'ignored' }],
    }],
    lexique: [{ ...cleanConfig.lexique[0], source: 'ignored' }],
    urgences: {
      ...cleanConfig.urgences,
      source: 'ignored',
      generalAlarm: { ...cleanConfig.urgences.generalAlarm, source: 'ignored' },
    },
  };
  const decoratedRouting = {
    ...cleanRouting,
    deploymentNote: 'must not affect authority identity',
    routes: [{ ...cleanRouting.routes[0], source: 'ignored' }],
    clarifications: [{ ...cleanRouting.clarifications[0], owner: 'ignored' }],
  };

  const clean = await unlockSnapshot(cleanConfig, cleanRouting);
  const decorated = await unlockSnapshot(decoratedConfig, decoratedRouting);

  assert.equal(decorated.configRevision, clean.configRevision);
  assert.equal(decorated.celineAuthorityRevision, clean.celineAuthorityRevision);
  assert.deepEqual(decorated.modules, clean.modules);
  assert.deepEqual(decorated.lexique, clean.lexique);
  assert.deepEqual(decorated.urgences, clean.urgences);
  assert.doesNotMatch(JSON.stringify(decorated), /deploymentNote|owner|source/);
});
