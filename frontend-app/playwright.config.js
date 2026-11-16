import { defineConfig, devices } from '@playwright/test';

const fixtureOrigin = process.env.ZEASYS_E2E_ORIGIN;

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.js',
  retries: 1,
  fullyParallel: true,
  reporter: 'list',
  use: { baseURL: fixtureOrigin || 'http://127.0.0.1:5500', ...devices['Desktop Chrome'], channel: 'chrome' },
  expect: { timeout: 20000 },
  timeout: 90000,
  webServer: fixtureOrigin ? undefined : { command: 'npx vite build && npx vite preview --host 127.0.0.1 --port 5500 --strictPort', url: 'http://127.0.0.1:5500', reuseExistingServer: true, timeout: 120000 },
});
