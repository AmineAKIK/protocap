import assert from 'node:assert/strict';
import test from 'node:test';
import { CONFIG_BUDGETS } from '../shared/configBudgets.js';
import {
  createCelineAuthorityRevision,
  parseCelineRoutingSpec,
  validateCelineRoutingSpec,
} from '../server/celineRoutingContract.mjs';
import { DEFAULT_SHIFTGUIDE_URGENCES } from '../server/shiftGuideDefaults.mjs';

const config = {
  modules: [{
    id: 'm1',
    title: 'M1',
    description: 'test',
    type: 'standard',
    actions: [{ id: 'a1', text: 'A1' }, { id: 'a2', text: 'A2' }],
  }],
  lexique: [],
  urgences: DEFAULT_SHIFTGUIDE_URGENCES,
  systemPromptExtra: null,
};

const spec = {
  version: 1,
  routes: [{ id: 'route_a', label: 'Route A', decisionGuide: 'Quand A.', actionIds: ['a1', 'a2'] }],
  clarifications: [{ id: 'clarify_a', question: 'Question ?', decisionGuide: 'Quand état absent.' }],
  classifierRules: ['Ne pas supposer.'],
};

test('routing contract accepts a complete spec compatible with ShiftGuide actions', () => {
  assert.deepEqual(validateCelineRoutingSpec(spec, config), { ok: true, errors: [] });
});

test('routing parsing tolerates metadata but gives it no semantic identity', () => {
  const raw = {
    ...spec,
    deploymentNote: 'ignored',
    routes: [{ ...spec.routes[0], source: 'ignored' }],
    clarifications: [{ ...spec.clarifications[0], owner: 'ignored' }],
  };
  const parsed = parseCelineRoutingSpec(raw, config);
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.value, spec);
  assert.equal(
    createCelineAuthorityRevision(parsed.value),
    createCelineAuthorityRevision(spec)
  );
});

test('routing contract rejects unknown actions and duplicate route/action ids', () => {
  const invalid = {
    ...spec,
    routes: [
      { ...spec.routes[0], actionIds: ['a1', 'a1', 'missing'] },
      { ...spec.routes[0] },
    ],
  };
  const result = validateCelineRoutingSpec(invalid, config);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('duplicates "a1"')));
  assert.ok(result.errors.some((error) => error.includes('unknown action "missing"')));
  assert.ok(result.errors.some((error) => error.includes('duplicates route "route_a"')));
});

test('routing contract enforces route cardinality and text budgets', () => {
  const tooManyRoutes = Array.from({ length: CONFIG_BUDGETS.routes + 1 }, (_, index) => ({
    id: `route_${index}`,
    label: `Route ${index}`,
    decisionGuide: 'Guide',
    actionIds: ['a1'],
  }));
  const cardinality = validateCelineRoutingSpec({ ...spec, routes: tooManyRoutes }, config);
  assert.equal(cardinality.ok, false);
  assert.match(cardinality.errors.join('\n'), new RegExp(`between 1 and ${CONFIG_BUDGETS.routes} routes`));

  const oversized = validateCelineRoutingSpec({
    ...spec,
    routes: [{ ...spec.routes[0], decisionGuide: 'x'.repeat(CONFIG_BUDGETS.textChars + 1) }],
  }, config);
  assert.equal(oversized.ok, false);
  assert.match(oversized.errors.join('\n'), new RegExp(`at most ${CONFIG_BUDGETS.textChars} characters`));
});

test('authority revision is deterministic and changes when routing semantics change', () => {
  const first = createCelineAuthorityRevision(spec);
  const reorderedKeys = {
    classifierRules: spec.classifierRules,
    clarifications: spec.clarifications,
    routes: spec.routes,
    version: spec.version,
  };
  assert.equal(createCelineAuthorityRevision(reorderedKeys), first);
  assert.match(first, /^sha256:[a-f0-9]{64}$/);

  const changed = {
    ...spec,
    routes: [{ ...spec.routes[0], decisionGuide: 'Autre condition de sélection.' }],
  };
  assert.notEqual(createCelineAuthorityRevision(changed), first);
});
