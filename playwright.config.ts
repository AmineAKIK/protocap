import { defineConfig, devices } from '@playwright/test';
import { E2E_HARNESS_MARKER } from './scripts/e2e-server-harness.mjs';

const suite = (process.env.PLAYWRIGHT_SUITE || 'default').replace(/[^a-z0-9-]/gi, '-');
const ci = Boolean(process.env.CI);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: ci ? 1 : 0,
  failOnFlakyTests: ci,
  outputDir: `test-results/playwright/${suite}`,
  reporter: ci
    ? [
        ['list'],
        ['html', { outputFolder: `playwright-report/${suite}`, open: 'never' }],
        ['json', { outputFile: `test-results/playwright/${suite}/results.json` }],
      ]
    : [['list'], ['html', { outputFolder: `playwright-report/${suite}`, open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium-mobile',
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  webServer: {
    command: 'node scripts/e2e-server-harness.mjs',
    url: 'http://127.0.0.1:4173/api/health',
    reuseExistingServer: false,
    timeout: 30_000,
    env: {
      [E2E_HARNESS_MARKER]: '1',
      DEEPSEEK_API_KEY: '',
    },
    gracefulShutdown: { signal: 'SIGTERM', timeout: 5_000 },
  },
});
