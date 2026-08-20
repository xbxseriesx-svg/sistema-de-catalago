import { defineConfig, devices } from '@playwright/test';

const baseURL = String(process.env.QA_E2E_BASE_URL || '').trim();
if (!baseURL) throw new Error('QA_E2E_BASE_URL ausente');

export default defineConfig({
  testDir: './tests/e2e-functional',
  testMatch: /remote-.*\.spec\.mjs$/,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium-remote-functional', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 } } },
  ],
});
