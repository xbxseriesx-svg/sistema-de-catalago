import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e-functional',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:8788',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium-functional', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 } } },
  ],
  webServer: {
    command: 'npx wrangler dev --ip 127.0.0.1 --port 8788 --local',
    url: 'http://127.0.0.1:8788/api/health',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
