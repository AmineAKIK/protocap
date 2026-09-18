import { defineConfig, devices } from '@playwright/test';

const suite = (process.env.PLAYWRIGHT_SUITE || 'public-demo').replace(/[^a-z0-9-]/gi, '-');
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
    baseURL: 'http://127.0.0.1:4176',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'chromium-mobile', use: { ...devices['Pixel 7'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: [
    {
      command: 'node scripts/public-demo-protected-e2e-harness.mjs',
      url: 'http://127.0.0.1:4176/api/health',
      reuseExistingServer: false,
      timeout: 30_000,
      env: {
        PROTOCAP_PUBLIC_DEMO_PROTECTED_E2E: '1',
        DEEPSEEK_API_KEY: '',
      },
      gracefulShutdown: { signal: 'SIGTERM', timeout: 5_000 },
    },
    {
      command: 'node scripts/public-demo-e2e-harness.mjs',
      url: 'http://127.0.0.1:4175/api/health',
      reuseExistingServer: false,
      timeout: 30_000,
      env: {
        PROTOCAP_PUBLIC_DEMO_E2E: '1',
        DEEPSEEK_API_KEY: '',
      },
      gracefulShutdown: { signal: 'SIGTERM', timeout: 5_000 },
    },
  ],
});
