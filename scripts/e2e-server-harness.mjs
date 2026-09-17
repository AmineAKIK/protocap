import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const E2E_HARNESS_MARKER = 'PROTOCAP_E2E_HARNESS';

const modules = [
  {
    id: 'module_standard',
    title: 'Module standard',
    description: 'Parcours E2E standard',
    type: 'standard',
    actions: [{ id: 'action_standard_1', text: 'Valider le contrôle E2E' }],
  },
  {
    id: 'module_choice',
    title: 'Module à choix',
    description: 'Parcours E2E alternatif',
    type: 'choice',
    subModules: [
      {
        id: 'scenario_a',
        title: 'Scénario A',
        actions: [{ id: 'choice_action_a', text: 'Traiter le scénario A' }],
      },
      {
        id: 'scenario_b',
        title: 'Scénario B',
        actions: [{ id: 'choice_action_b', text: 'Traiter le scénario B' }],
      },
    ],
  },
];

const lexique = [{ sigle: 'E2E', definition: 'End-to-end' }];
const celineRouting = {
  version: 1,
  routes: [
    {
      id: 'module_standard',
      label: 'Module standard',
      decisionGuide: 'Parcours E2E standard.',
      actionIds: ['action_standard_1'],
    },
  ],
  clarifications: [
    {
      id: 'clarifier_situation',
      question: 'Précise la situation E2E.',
      decisionGuide: 'Situation E2E ambiguë.',
    },
  ],
  classifierRules: ['Ne jamais supposer un état absent.'],
};

const syntheticEnvironment = Object.freeze({
  [E2E_HARNESS_MARKER]: '1',
  NODE_ENV: 'test',
  TZ: 'UTC',
  PORT: '4173',
  SHIFTGUIDE_CODE: 'e2e-access-code',
  DEEPSEEK_API_KEY: '',
  SG_MODULES: JSON.stringify(modules),
  SG_LEXIQUE: JSON.stringify(lexique),
  SG_CELINE_ROUTING: JSON.stringify(celineRouting),
});

export function createE2eServerEnvironment() {
  return { ...syntheticEnvironment };
}

export function replaceEnvironment(target, nextEnvironment) {
  for (const key of Object.keys(target)) delete target[key];
  Object.assign(target, nextEnvironment);
  return target;
}

export async function startE2eServer(environment = process.env) {
  if (environment[E2E_HARNESS_MARKER] !== '1') {
    throw new Error('The synthetic E2E server must be started by the Playwright harness.');
  }

  replaceEnvironment(environment, createE2eServerEnvironment());
  console.log(JSON.stringify({
    level: 'info',
    event: 'e2e_harness_started',
    profile: 'synthetic',
    externalProviderConfigured: false,
  }));
  await import('../server.mjs');
}

const isMain = process.argv[1]
  ? import.meta.url === pathToFileURL(resolve(process.argv[1])).href
  : false;

if (isMain) {
  await startE2eServer();
}
