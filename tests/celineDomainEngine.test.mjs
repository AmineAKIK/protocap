import assert from 'node:assert/strict';
import test from 'node:test';
import { createCelineDomainEngine } from '../server/celineDomainEngine.mjs';
import { createCelineSemanticIndex } from '../server/celineSemanticIndex.mjs';

function makeAction(id, text, module = 'Production') {
  return [id, { text, note: null, module }];
}

function createFixture() {
  const actions = new Map([
    makeAction('dp_01', 'Prendre le poste', 'Début poste'),
    makeAction('fp_01', 'Clôturer le poste', 'Fin poste'),
    makeAction('doc_01', 'Vérifier la disponibilité des AC', 'Début OC'),
    makeAction('doc_02', "Ouvrir l'OC", 'Début OC'),
    makeAction('foc_01', "Faire le contrôle de fin d'OC", 'Fin OC'),
    makeAction('dc_01', 'Vérifier la référence du jus et le numéro de cuve', 'Début cuve'),
    makeAction('fc_01', 'Faire les prélèvements de fin de cuve', 'Fin cuve'),
    makeAction('prod_01', 'Faire et valider les contrôles qualité', 'Production'),
    makeAction('prod_02', 'Faire les prélèvements microbio — 5 minimum par OC', 'Production'),
    makeAction('chf_01', 'Appliquer le changement de formule', 'Changement OC'),
  ]);
  const routes = new Map([
    ['debut_poste_arretee_oc', { id: 'debut_poste_arretee_oc', label: 'Début poste arrêté + OC', actionIds: ['dp_01', 'doc_01'] }],
    ['debut_poste_arretee_sans_oc', { id: 'debut_poste_arretee_sans_oc', label: 'Début poste arrêté', actionIds: ['dp_01'] }],
    ['debut_poste_production', { id: 'debut_poste_production', label: 'Début poste production', actionIds: ['dp_01'] }],
    ['fin_poste_cloture', { id: 'fin_poste_cloture', label: 'Fin poste', actionIds: ['fp_01'] }],
    ['fin_poste_avec_oc', { id: 'fin_poste_avec_oc', label: 'Fin poste avec OC', actionIds: ['foc_01', 'fp_01'] }],
    ['fin_poste_avec_cuve_oc', { id: 'fin_poste_avec_cuve_oc', label: 'Fin poste avec cuve et OC', actionIds: ['fc_01', 'foc_01', 'fp_01'] }],
    ['debut_oc', { id: 'debut_oc', label: 'Début OC', actionIds: ['doc_01', 'doc_02'] }],
    ['debut_oc_precedent_ouvert', { id: 'debut_oc_precedent_ouvert', label: 'Clôturer puis début OC', actionIds: ['foc_01', 'doc_01', 'doc_02'] }],
    ['fin_oc', { id: 'fin_oc', label: 'Fin OC', actionIds: ['foc_01'] }],
    ['debut_cuve', { id: 'debut_cuve', label: 'Début cuve', actionIds: ['dc_01'] }],
    ['debut_cuve_sans_oc', { id: 'debut_cuve_sans_oc', label: 'Ouvrir OC puis début cuve', actionIds: ['doc_01', 'dc_01'] }],
    ['fin_cuve', { id: 'fin_cuve', label: 'Fin cuve', actionIds: ['fc_01'] }],
    ['changement_cuve', { id: 'changement_cuve', label: 'Changement cuve', actionIds: ['fc_01', 'dc_01'] }],
    ['changement_oc_formule_cloture', { id: 'changement_oc_formule_cloture', label: 'Changement formule', actionIds: ['chf_01', 'doc_01'] }],
    ['changement_oc_formule_ouvert', { id: 'changement_oc_formule_ouvert', label: 'Clôture + changement formule', actionIds: ['foc_01', 'chf_01', 'doc_01'] }],
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

test('start shift asks atomic prerequisites and selects the stopped-line route without provider', () => {
  const engine = createFixture();
  const first = engine.handleBeforeProvider(engine.initialState(), 'je commence mon poste');
  assert.equal(first.state.pendingQuestion.id, 'debut_poste_etat');

  const second = engine.handleBeforeProvider(first.state, 'la ligne est arrêtée');
  assert.equal(second.state.pendingQuestion.id, 'debut_poste_oc');

  const third = engine.handleBeforeProvider(second.state, 'non');
  assert.equal(third.decision.id, 'debut_poste_arretee_sans_oc');
  assert.equal(third.response.checklist[0].actionId, 'dp_01');
});

test('finish shift asks OC then tank state and selects the combined route deterministically', () => {
  const engine = createFixture();
  const first = engine.handleBeforeProvider(engine.initialState(), 'je finis mon poste');
  assert.equal(first.state.pendingQuestion.id, 'fin_poste_oc');
  const second = engine.handleBeforeProvider(first.state, 'oui');
  assert.equal(second.state.pendingQuestion.id, 'fin_poste_cuve');
  const third = engine.handleBeforeProvider(second.state, 'oui');
  assert.equal(third.decision.id, 'fin_poste_avec_cuve_oc');
  assert.equal(third.response.checklist[0].actionId, 'fc_01');
});

test('change OC extracts type then asks only for the missing previous-OC state', () => {
  const engine = createFixture();
  const first = engine.handleBeforeProvider(engine.initialState(), "j'ai un changement d'OC de formule");
  assert.equal(first.state.changeType, 'formule');
  assert.equal(first.state.pendingQuestion.id, 'changement_oc_precedent');
  const second = engine.handleBeforeProvider(first.state, 'oui');
  assert.equal(second.decision.id, 'changement_oc_formule_cloture');
  assert.equal(second.response.checklist[0].actionId, 'chf_01');
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
