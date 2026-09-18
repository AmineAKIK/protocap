import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEMO_SHIFTGUIDE_CODE,
  createDemoServerEnvironment,
} from '../demo/runtimeFixtures.mjs';
import { createScenarioProvider } from '../server/providers/demoScenarioProvider.mjs';

test('demo environment strips inherited provider credentials and injects synthetic configuration', () => {
  const env = createDemoServerEnvironment({
    DEEPSEEK_API_KEY: 'sentinel-secret',
    SHIFTGUIDE_CODE: 'real-code',
    SOME_UNRELATED_VALUE: 'kept',
  });

  assert.equal(env.PROTOCAP_RUNTIME_PROFILE, 'demo');
  assert.equal(env.DEEPSEEK_API_KEY, '');
  assert.equal(env.SHIFTGUIDE_CODE, DEMO_SHIFTGUIDE_CODE);
  assert.equal(env.SOME_UNRELATED_VALUE, 'kept');
  assert.equal(env.PROTOCAP_PUBLIC_URL, 'http://127.0.0.1:4173');
  assert.match(env.SG_MODULES, /Démarrage synthétique/);
  assert.match(env.SG_CELINE_ROUTING, /demo_start/);
});

test('scripted demo provider covers route clarification and unknown outcomes without network access', async () => {
  const provider = createScenarioProvider();

  assert.deepEqual(
    JSON.parse(await provider.complete({ history: [{ role: 'user', content: 'Montre-moi le parcours' }] })),
    { kind: 'route', id: 'demo_start' },
  );
  assert.deepEqual(
    JSON.parse(await provider.complete({ history: [{ role: 'user', content: 'Il faut clarifier' }] })),
    { kind: 'clarify', id: 'demo_clarify' },
  );
  assert.deepEqual(
    JSON.parse(await provider.complete({ history: [{ role: 'user', content: 'cas inconnu' }] })),
    { kind: 'unknown' },
  );
  await assert.rejects(
    provider.complete({ history: [{ role: 'user', content: 'provider indisponible' }] }),
    /Synthetic provider unavailable/,
  );
});
