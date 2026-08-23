import { defineConfig, devices } from '@playwright/test';

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

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list']] : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'node server.mjs',
    url: 'http://127.0.0.1:4173/api/health',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: '4173',
      SHIFTGUIDE_CODE: 'e2e-access-code',
      SG_MODULES: JSON.stringify(modules),
      SG_LEXIQUE: JSON.stringify(lexique),
      SG_CELINE_ROUTING: JSON.stringify(celineRouting),
    },
  },
});
