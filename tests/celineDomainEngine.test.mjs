import assert from 'node:assert/strict';
import test from 'node:test';
import { createCelineDomainEngine } from '../server/celineDomainEngine.mjs';
import { createCelineSemanticIndex } from '../server/celineSemanticIndex.mjs';

function makeAction(id, text, module = 'Production') {
  return [id, { text, note: null, module }];
}

function createFixture() {
  const actions = new Map([
    makeAction('doc_01', 'Vérifier la disponibilité des AC', 'Début OC'),
    makeAction('doc_02', "Ouvrir l'OC", 'Début OC'),
    makeAction('foc_01', "Faire le contrôle de fin d'OC", 'Fin OC'),
    makeAction('dc_01', 'Vérifier la référence du jus et le numéro de cuve', 'Début cuve'),
    makeAction('fc_01', 'Faire les prélèvements de fin de cuve', 'Fin cuve'),
    makeAction('prod_01', 'Faire et valider les contrôles qualité', 'Production'),
    makeAction('prod_02', 'Faire les prélèvements microbio — 5 minimum par OC', 'Production'),
  ]);
  const routes = new Map([
    ['debut_oc', { id: 'debut_oc', label: 'Début OC', actionIds: ['doc_01', 'doc_02'] }],
    ['debut_oc_precedent_ouvert', { id: 'debut_oc_precedent_ouvert', label: 'Clôturer puis début OC', actionIds: ['foc_01', 'doc_01', 'doc_02'] }],
    ['fin_oc', { id: 'fin_oc', label: 'Fin OC', actionIds: ['foc_01'] }],
    ['debut_cuve', { id: 'debut_cuve', label: 'Début cuve', actionIds: ['dc_01'] }],
    ['debut_cuve_sans_oc', { id: 'debut_cuve_sans_oc', label: 'Ouvrir OC puis début cuve', actionIds: ['doc_01', 'dc_01'] }],
    ['fin_cuve', { id: 'fin_cuve', label: 'Fin cuve', actionIds: ['fc_01'] }],
    ['changement_cuve', { id: 'changement_cuve', label: 'Changement cuve', actionIds: ['fc_01', 'dc_01'] }],
    ['production', { id: 'production', label: 'Production', actionIds: ['prod_01', 'prod_02'] }],
  ]);
  const authority = {
    actions,
    routes,
    clarifications: new Map([
      ['debut_oc_precedent', { question: 'L’OC précédent est-il déjà clôturé ?' }],
      ['debut_cuve_oc', { question: 'Un OC est-il déjà ouvert ?' }],
    ]),
    classifierRules: [],
    lexicon: new Map([['SPCB', 'Sous Par ComBien']]),
    urgences: {},
  };
  const config = {
    modules: [
      { id: 'debut_oc', title: 'Début OC', description: '', type: 'standard', actions: [
        { id: 'doc_01', text: 'Vérifier la disponibilité des AC' },
        { id: 'doc_02', text: "Ouvrir l'OC" },
      ] },
      { id: 'fin_cuve', title: 'Fin cuve', description: '', type: 'standard', actions: [
        { id: 'fc_01', text: 'Faire les prélèvements de fin de cuve' },
      ] },
      { id: 'production', title: 'Production', description: '', type: 'standard', actions: [
        { id: 'prod_01', text: 'Faire et valider les contrôles qualité' },
        { id: 'prod_02', text: 'Faire les prélèvements microbio — 5 minimum par OC' },
      ] },
    ],
  };
  return createCelineDomainEngine({
    authority,
    semanticIndex: createCelineSemanticIndex(config),
  });
}

test('greetings are deterministic and do not require the provider', () => {
  const engine = createFixture();
  const result = engine.handleBeforeProvider(engine.initialState(), 'bonjour');
  assert.equal(result.handled, true);
  assert.equal(result.decision.kind, 'conversation');
  assert.match(result.response.message, /Bonjour/);
});

test('start OC asks for missing prerequisite then resolves yes without provider', () => {
  const engine = createFixture();
  const first = engine.handleBeforeProvider(engine.initialState(), 'je lance un OC');
  assert.equal(first.decision.kind, 'clarify');
  assert.equal(first.state.pendingQuestion.id, 'debut_oc_precedent');

  const second = engine.handleBeforeProvider(first.state, 'oui');
  assert.equal(second.decision.kind, 'route');
  assert.equal(second.decision.id, 'debut_oc');
  assert.equal(second.response.checklist.length, 1);
  assert.equal(second.response.checklist[0].actionId, 'doc_01');
  assert.equal(second.response.workflow.currentIndex, 0);
});

test('workflow completion phrase advances one canonical action without provider', () => {
  const engine = createFixture();
  const asked = engine.handleBeforeProvider(engine.initialState(), 'je lance un OC');
  const started = engine.handleBeforeProvider(asked.state, 'oui');
  const advanced = engine.handleBeforeProvider(started.state, "c'est fait");
  assert.equal(advanced.decision.kind, 'navigate');
  assert.equal(advanced.response.checklist[0].actionId, 'doc_02');
  assert.equal(advanced.response.workflow.currentIndex, 1);
});

test('procedure questions return only semantically relevant actions', () => {
  const engine = createFixture();
  let state = engine.initialState();
  const providerRoute = engine.handleProviderDecision(
    state,
    { kind: 'route', id: 'production' },
    () => null
  );
  state = providerRoute.state;

  const answer = engine.handleBeforeProvider(state, 'je dois faire quoi comme prélèvement ?');
  assert.equal(answer.handled, true);
  assert.equal(answer.decision.kind, 'query');
  assert.deepEqual(answer.response.checklist.map((item) => item.actionId), ['prod_02']);
});

test('exact lexicon lookup is deterministic', () => {
  const engine = createFixture();
  const result = engine.handleBeforeProvider(engine.initialState(), "c'est quoi SPCB ?");
  assert.equal(result.handled, true);
  assert.equal(result.decision.kind, 'lexicon');
  assert.match(result.response.message, /Sous Par ComBien/);
});
