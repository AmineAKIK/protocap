export const TEST_CELINE_ROUTING_SPEC = {
  version: 1,
  routes: [
    {
      id: 'module_standard',
      label: 'Module standard',
      decisionGuide: 'Utiliser pour le module standard de test.',
      actionIds: ['action_1'],
    },
  ],
  clarifications: [
    {
      id: 'clarifier_situation',
      question: 'Peux-tu préciser la situation ?',
      decisionGuide: 'Utiliser quand la situation de test est ambiguë.',
    },
  ],
  classifierRules: ['Ne jamais supposer un état absent.'],
};
