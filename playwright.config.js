const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4173' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } }
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI
  }
});
