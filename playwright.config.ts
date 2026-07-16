import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'tablet', use: { ...devices['iPad (gen 7)'] } },
  ],
  webServer: {
    command: 'npm run build && node server.mjs',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: '4173',
      SHIFTGUIDE_ACCESS_CODE: 'atelier-42',
      SHIFTGUIDE_SESSION_SECRET: 'playwright-session-secret-at-least-32-characters',
      SG_MODULES: '[]',
      SG_LEXIQUE: '[]',
    },
  },
});
