import assert from 'node:assert/strict';
import test from 'node:test';
import { createCelineDomainEngine } from '../server/celineDomainEngine.mjs';
import { createCelineSemanticIndex } from '../server/celineSemanticIndex.mjs';
import { withCelineState } from '../server/celineOperationalState.mjs';

function createEngine() {
  const actions = new Map([
    ['doc_01', { text: 'Ouvrir le nouvel OC', note: null, module: 'Début OC' }],
    ['foc_01', { text: 'Clôturer l’OC courant', note: null, module: 'Fin OC' }],
    ['dc_01', { text: 'Démarrer la nouvelle cuve', note: null, module: 'Début cuve' }],
    ['fc_01', { text: 'Clôturer la cuve courante', note: null, module: 'Fin cuve' }],
    ['chf_01', { text: 'Appliquer le changement formule', note: null, module: 'Changement OC' }],
  ]);
  const routes = new Map([
    ['debut_oc', { id: 'debut_oc', label: 'Début OC', actionIds: ['doc_01'] }],
    ['debut_oc_precedent_ouvert', { id: 'debut_oc_precedent_ouvert', label: 'Clôturer puis début OC', actionIds: ['foc_01', 'doc_01'] }],
    ['debut_cuve', { id: 'debut_cuve', label: 'Début cuve', actionIds: ['dc_01'] }],
    ['debut_cuve_sans_oc', { id: 'debut_cuve_sans_oc', label: 'OC puis début cuve', actionIds: ['doc_01', 'dc_01'] }],
    ['changement_cuve', { id: 'changement_cuve', label: 'Changement cuve', actionIds: ['fc_01', 'dc_01'] }],
    ['changement_oc_formule_cloture', { id: 'changement_oc_formule_cloture', label: 'Changement formule', actionIds: ['chf_01', 'doc_01'] }],
    ['changement_oc_formule_ouvert', { id: 'changement_oc_formule_ouvert', label: 'Clôture + changement formule', actionIds: ['foc_01', 'chf_01', 'doc_01'] }],
  ]);
  const authority = {
    actions,
    routes,
    clarifications: new Map(),
    classifierRules: [],
    lexicon: new Map(),
    urgences: {},
  };
  const config = {
    modules: [
      { id: 'debut_oc', title: 'Début OC', description: '', type: 'standard', actions: [{ id: 'doc_01', text: 'Ouvrir le nouvel OC' }] },
      { id: 'fin_oc', title: 'Fin OC', description: '', type: 'standard', actions: [{ id: 'foc_01', text: 'Clôturer l’OC courant' }] },
      { id: 'debut_cuve', title: 'Début cuve', description: '', type: 'standard', actions: [{ id: 'dc_01', text: 'Démarrer la nouvelle cuve' }] },
      { id: 'fin_cuve', title: 'Fin cuve', description: '', type: 'standard', actions: [{ id: 'fc_01', text: 'Clôturer la cuve courante' }] },
      { id: 'changement_oc', title: 'Changement OC', description: '', type: 'standard', actions: [{ id: 'chf_01', text: 'Appliquer le changement formule' }] },
    ],
  };
  return createCelineDomainEngine({ authority, semanticIndex: createCelineSemanticIndex(config) });
}

test('provider cannot force the open-OC variant when domain state says the previous OC is closed', () => {
  const engine = createEngine();
  const state = withCelineState(engine.initialState(), { ocStatus: 'closed' });
  const result = engine.handleProviderDecision(
    state,
    { kind: 'route', id: 'debut_oc_precedent_ouvert' },
    () => null
  );

  assert.equal(result.handled, true);
  assert.equal(result.decision.id, 'debut_oc');
  assert.equal(result.response.checklist[0].actionId, 'doc_01');
});

test('provider cannot force the closed-OC change variant when domain state says the OC is open', () => {
  const engine = createEngine();
  const state = withCelineState(engine.initialState(), { ocStatus: 'open' });
  const result = engine.handleProviderDecision(
    state,
    { kind: 'route', id: 'changement_oc_formule_cloture' },
    () => null
  );

  assert.equal(result.handled, true);
  assert.equal(result.decision.id, 'changement_oc_formule_ouvert');
  assert.equal(result.response.checklist[0].actionId, 'foc_01');
});

test('provider cannot silently assume a current tank during a tank change', () => {
  const engine = createEngine();
  const state = withCelineState(engine.initialState(), { ocStatus: 'open', tankStatus: 'unknown' });
  const result = engine.handleProviderDecision(
    state,
    { kind: 'route', id: 'changement_cuve' },
    () => null
  );

  assert.equal(result.handled, true);
  assert.equal(result.decision.kind, 'clarify');
  assert.equal(result.state.pendingQuestion.id, 'changement_cuve_ouverte');
});
