import { defineConfig, devices } from '@playwright/test';
import { E2E_HARNESS_MARKER } from './scripts/e2e-server-harness.mjs';

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
