import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'production-ui-compat.spec.mjs',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://asteryon.test:8788',
    launchOptions: { args: ['--host-resolver-rules=MAP asteryon.test 127.0.0.1,EXCLUDE localhost'] },
    trace: 'retain-on-failure', screenshot: 'only-on-failure', video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 } } },
    { name: 'chromium-mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'E2E_PORT=8788 node scripts/serve-production-compat.mjs',
    url: 'http://127.0.0.1:8788/__e2e_health',
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
