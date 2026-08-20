import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 1,
  reporter: [['list']],
  use: {
    // O frontend trata localhost/127.0.0.1 como modo local. Usar um subdomínio
    // .localhost mantém o loopback, mas exercita o mesmo fluxo cloud da produção.
    baseURL: 'http://asteryon.localhost:8787',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 } } },
    { name: 'chromium-mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'node scripts/serve-e2e-static-v89.mjs',
    url: 'http://127.0.0.1:8787/__e2e_health',
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
