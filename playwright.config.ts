import { defineConfig, devices } from '@playwright/test';

// Real-browser smoke tests of the built `dist/` (run `npm run build` first, or `npm run test:e2e`).
// The unit suite runs in jsdom, which has no layout, focus-on-click or `:disabled` inside a disabled fieldset.
export default defineConfig({
  testDir: 'e2e',
  timeout: 10_000,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: 'http://localhost:4173' },
  webServer: { command: 'node e2e/server.mjs', url: 'http://localhost:4173/e2e/page.html', reuseExistingServer: !process.env.CI },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
