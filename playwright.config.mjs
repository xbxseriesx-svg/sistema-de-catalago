import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  // A UI realmente publicada em public/ possui servidor/configuração próprios.
  // Mantê-la fora deste conjunto evita testar o V94 contra o servidor do SPA de fonte.
  testIgnore: 'production-ui-compat.spec.mjs',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 1,
  reporter: [['list']],
  use: {
    // O frontend trata localhost/127.0.0.1 como modo local. O hostname asteryon.test
    // ativa o fluxo cloud e é mapeado pelo próprio Chromium para 127.0.0.1, sem DNS.
    baseURL: 'http://asteryon.test:8787',
    launchOptions: {
      args: ['--host-resolver-rules=MAP asteryon.test 127.0.0.1,EXCLUDE localhost'],
    },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 } } },
    { name: 'chromium-mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npm run prepare:frontend && node scripts/serve-enterprise-spa.mjs',
    url: 'http://127.0.0.1:8787/__e2e_health',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
