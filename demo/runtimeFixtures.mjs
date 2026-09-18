export const DEMO_SHIFTGUIDE_CODE = 'protocap-demo';

export const DEMO_MODULES = Object.freeze([
  {
    id: 'demo_start',
    title: 'Démarrage synthétique',
    description: 'Parcours fictif de prise de poste pour la démonstration locale.',
    type: 'standard',
    actions: [
      { id: 'demo_check_zone', text: 'Vérifier la zone de travail fictive.' },
      { id: 'demo_confirm_line', text: 'Confirmer la ligne de démonstration.' },
    ],
  },
  {
    id: 'demo_quality',
    title: 'Contrôle synthétique',
    description: 'Choix de scénario fictif sans donnée opérationnelle.',
    type: 'choice',
    subModules: [
      {
        id: 'demo_quality_ok',
        title: 'Situation nominale',
        actions: [{ id: 'demo_quality_action_ok', text: 'Consigner le contrôle fictif.' }],
      },
      {
        id: 'demo_quality_stop',
        title: 'Situation à clarifier',
        actions: [{ id: 'demo_quality_action_stop', text: 'Stopper le scénario fictif et demander une précision.' }],
      },
    ],
  },
]);

export const DEMO_LEXIQUE = Object.freeze([
  { sigle: 'DEMO', definition: 'Données fictives utilisées uniquement pour la démonstration ProtoCap.' },
]);

export const DEMO_CELINE_ROUTING = Object.freeze({
  version: 1,
  routes: [
    {
      id: 'demo_start',
      label: 'Démarrage synthétique',
      decisionGuide: 'Utiliser ce parcours pour une demande générale de démonstration.',
      actionIds: ['demo_check_zone', 'demo_confirm_line'],
    },
  ],
  clarifications: [
    {
      id: 'demo_clarify',
      question: 'Précise la situation fictive à traiter.',
      decisionGuide: 'Demander une précision lorsque le scénario synthétique est volontairement ambigu.',
    },
  ],
  classifierRules: [
    'Les données sont fictives.',
    'Ne jamais déduire une situation opérationnelle réelle.',
  ],
});

export function createDemoServerEnvironment(base = {}) {
  return {
    ...base,
    NODE_ENV: 'development',
    PROTOCAP_RUNTIME_PROFILE: 'demo',
    PROTOCAP_DEMO_GUARD: 'synthetic-v1',
    PROTOCAP_PUBLIC_URL: base.PROTOCAP_PUBLIC_URL || 'http://127.0.0.1:4173',
    SHIFTGUIDE_CODE: DEMO_SHIFTGUIDE_CODE,
    DEEPSEEK_API_KEY: '',
    SG_MODULES: JSON.stringify(DEMO_MODULES),
    SG_LEXIQUE: JSON.stringify(DEMO_LEXIQUE),
    SG_SYSTEM_PROMPT: 'Mode démonstration : données fictives et réponses scénarisées, sans appel IA externe.',
    SG_CELINE_ROUTING: JSON.stringify(DEMO_CELINE_ROUTING),
  };
}
