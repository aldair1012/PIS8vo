import { defineConfig, devices } from '@playwright/test';

const fixtureOrigin = process.env.ZEASYS_E2E_ORIGIN;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  reporter: 'list',
  use: { baseURL: fixtureOrigin || 'http://127.0.0.1:5500', ...devices['Desktop Chrome'], channel: 'chrome' },
  webServer: fixtureOrigin ? undefined : { command: 'npm run dev -- --host 127.0.0.1', url: 'http://127.0.0.1:5500', reuseExistingServer: false, timeout: 30000 },
});
