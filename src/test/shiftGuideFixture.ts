import type { ShiftGuideData } from '../types/shiftGuide';

export const shiftGuideFixture: ShiftGuideData = {
  modules: [
    {
      id: 'module_standard',
      title: 'Module standard',
      description: 'Fixture frontend',
      type: 'standard',
      actions: [
        { id: 'action_1', text: 'Première action' },
        { id: 'action_2', text: 'Deuxième action', note: 'Note fixture' },
      ],
    },
    {
      id: 'module_choice',
      title: 'Module à choix',
      description: 'Fixture scénario',
      type: 'choice',
      subModules: [
        {
          id: 'scenario_a',
          title: 'Scénario A',
          actions: [{ id: 'choice_action_1', text: 'Action scénario A' }],
        },
        {
          id: 'scenario_b',
          title: 'Scénario B',
          actions: [{ id: 'choice_action_2', text: 'Action scénario B' }],
        },
      ],
    },
  ],
  lexique: [{ sigle: 'OC', definition: 'Ordre de Conditionnement' }],
  urgences: {
    emergencyNumbers: ['15', '18'],
    generalAlarm: {
      signal: 'Sirène longue',
      instruction: 'Évacuer immédiatement',
      steps: ['Rejoindre la sortie de secours'],
    },
    drill: {
      schedule: 'Premier mardi du mois',
      instruction: 'Suivre la consigne locale',
    },
    accidentSteps: [
      { id: 'proteger', label: 'Protéger', description: 'Sécuriser la zone.' },
    ],
    goldenRules: [
      { id: 'loto', label: 'LOTO', description: 'Respecter la consignation.' },
    ],
    priorityMessage: 'Stopper et alerter en cas de doute.',
    priorityDescription: 'La sécurité des personnes reste prioritaire.',
  },
};
