// End-to-end tests of the built site (dist/) on phone, tablet and desktop.
// Usage: npm run test:e2e   (builds dist/ and serves it on port 4173 first)
const { defineConfig, devices } = require('@playwright/test');

const CI = !!process.env.CI;
module.exports = defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  reporter: CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: { baseURL: 'http://localhost:4173', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: {
    command: 'node tools/e2e-build.js && node tools/serve.js dist 4173',
    url: 'http://localhost:4173',
    reuseExistingServer: !CI,
    timeout: 60_000,
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'wide-chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 2560, height: 1440 } } },
    { name: 'tablet-webkit', use: { ...devices['iPad Mini'] } },
    { name: 'phone-webkit', use: { ...devices['iPhone 13'] } },
    { name: 'phone-chromium', use: { ...devices['Pixel 7'] } },
  ],
});
